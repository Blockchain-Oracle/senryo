import {
  DEVICE_HASH_MAX_CHARS,
  DEVICE_HEADER,
  starterClaimRoute,
  starterRelayRoute,
  starterStatusRoute,
  starterVoucherRoute,
} from "@senryo/api-client";
import { type Address, readContract, startBlockOf, verifyClaimSignature, verifyVoucherSignature } from "@senryo/chain";
import { type ChainId, MAINNET_CHAIN_ID } from "@senryo/config";
import { RELAY_SIGNATURE_MAX_TTL_SECONDS } from "@senryo/core";
import {
  HTTP_STATUS,
  HttpError,
  type HttpServer,
  MS_PER_SECOND,
  parseRoute,
  SECONDS_PER_DAY,
  sendRoute,
} from "@senryo/service-common";
import type { FastifyRequest } from "fastify";
import { CLOUDFLARE_TURNSTILE_VERIFY, UPSTREAM_TIMEOUT_MS } from "../constants.ts";
import { type ApiContext, chainOf } from "../context.ts";
import { geoOf, networkPrefix } from "../geo.ts";
import { type ClaimRow, relay, relayFromRow, starterConfig } from "../starter.ts";
import { reconcileRelay } from "../topup.ts";

const RELAY_RATE = { max: 10, timeWindow: "1 minute" } as const;

/** Header-less (or oversized) clients share ONE device bucket, so omitting the header never skips the limit (S8.5b #1). */
const UNKNOWN_DEVICE = "unknown";

export function deviceOf(request: FastifyRequest): string {
  const raw = request.headers[DEVICE_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && value.length <= DEVICE_HASH_MAX_CHARS ? value : UNKNOWN_DEVICE;
}

/**
 * Bot check (S8.5b #1, D-166): with `TURNSTILE_SECRET` set, a token is REQUIRED (omitting it no longer passes).
 * Mainnet gas drips require the check to be configured at all; practice keeps working without it (testnet MON only).
 */
async function turnstileOk(ctx: ApiContext, chainId: number, token: string | undefined, ip: string): Promise<boolean> {
  if (!ctx.secrets.turnstileSecret) return chainId !== MAINNET_CHAIN_ID;
  if (!token) return false;
  const form = new URLSearchParams({ secret: ctx.secrets.turnstileSecret, response: token, remoteip: ip });
  const res = await fetch(CLOUDFLARE_TURNSTILE_VERIFY, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  const json = (await res.json().catch(() => ({}))) as { success?: boolean };
  return json.success === true;
}

/**
 * Next time this device / network may claim (null = now). One claim per device and a few per /24 per day — counted
 * against the CURRENT StarterDrip only (claims on a replaced drip, e.g. before the D-164 redeploy, don't block; S8.16e).
 */
async function nextClaimAt(ctx: ApiContext, chainId: number, device: string, prefix: string) {
  const dripFrom = startBlockOf(chainId as ChainId, "StarterDrip");
  const [row] = await ctx.db<{ device_count: bigint; net_count: bigint; oldest: Date | null }[]>`
    SELECT count(*) FILTER (WHERE device_hash = ${device})::bigint AS device_count,
           count(*) FILTER (WHERE ip_prefix = ${prefix})::bigint AS net_count,
           min(created_at) AS oldest
      FROM starter_claims
     WHERE chain_id = ${chainId} AND kind = 'claim' AND stage NOT IN ('reverted', 'abandoned')
       AND (block_number IS NULL OR block_number >= ${dripFrom})
       AND created_at > now() - make_interval(secs => ${SECONDS_PER_DAY})
       AND (device_hash = ${device} OR ip_prefix = ${prefix})`;
  const limited =
    (row?.device_count ?? 0n) >= BigInt(ctx.env.STARTER_PER_DEVICE_PER_DAY) ||
    (row?.net_count ?? 0n) >= BigInt(ctx.env.STARTER_PER_NETWORK_PER_DAY);
  return limited && row?.oldest ? new Date(row.oldest.getTime() + SECONDS_PER_DAY * MS_PER_SECOND) : null;
}

export function checkDeadline(deadline: bigint): void {
  const now = BigInt(Math.floor(Date.now() / MS_PER_SECOND));
  if (deadline <= now)
    throw new HttpError(HTTP_STATUS.badRequest, "SIGNATURE_EXPIRED", "signature deadline has passed");
  if (deadline > now + BigInt(RELAY_SIGNATURE_MAX_TTL_SECONDS)) {
    throw new HttpError(HTTP_STATUS.badRequest, "BAD_REQUEST", "deadline too far in the future");
  }
}

/**
 * One relay per (chain, user, kind) in flight (S8.5b #4): parallel replays of one signature used to pass simulation
 * together and burn sponsor gas on the reverts. One api instance serves all traffic (D-121), so a process-local set
 * suffices; the starter_claims row still records the outcome.
 */
const inflight = new Set<string>();
export async function once<T>(key: string, run: () => Promise<T>): Promise<T> {
  if (inflight.has(key))
    throw new HttpError(HTTP_STATUS.conflict, "RELAYER_BUSY", "a relay for this account is in flight");
  inflight.add(key);
  try {
    return await run();
  } finally {
    inflight.delete(key);
  }
}

/** D-038: practice is never gated; mainnet starter funds follow the mainnet trading geofence (F05 "geo (mainnet only)"). */
export function checkGeo(ctx: ApiContext, chainId: number, request: Parameters<typeof geoOf>[0]): void {
  if (chainId !== MAINNET_CHAIN_ID) return;
  const geo = geoOf(request, { db: ctx.geo, trustedHeader: ctx.env.TRUSTED_COUNTRY_HEADER });
  if (!geo.mainnetTradingAllowed) {
    throw new HttpError(HTTP_STATUS.forbidden, "GEO_BLOCKED", geo.reason ?? "not available in this region");
  }
}

export function registerStarterRoutes(app: HttpServer, ctx: ApiContext): void {
  app.post(starterClaimRoute.path, { config: { rateLimit: RELAY_RATE } }, async (request, reply) => {
    const { body } = parseRoute(starterClaimRoute, request);
    const chain = chainOf(ctx, body.chainId);
    checkGeo(ctx, body.chainId, request);
    checkDeadline(body.deadline);
    const signed = await verifyClaimSignature({
      chainId: body.chainId,
      user: body.user,
      deadline: body.deadline,
      signature: body.signature,
    });
    if (!signed)
      throw new HttpError(HTTP_STATUS.badRequest, "SIGNATURE_INVALID", "claim signature does not match the user");
    if (!(await turnstileOk(ctx, body.chainId, body.turnstileToken, request.ip))) {
      throw new HttpError(HTTP_STATUS.forbidden, "TURNSTILE_FAILED", "bot check failed");
    }
    const device = deviceOf(request);
    const prefix = networkPrefix(request.ip);
    const next = await nextClaimAt(ctx, body.chainId, device, prefix);
    if (next) {
      const wait = Math.max(Math.ceil((next.getTime() - Date.now()) / MS_PER_SECOND), 0);
      throw new HttpError(HTTP_STATUS.tooMany, "RATE_LIMITED", "one claim per device per day", wait);
    }
    const result = await once(`${body.chainId}:${body.user.toLowerCase()}:claim`, async () => {
      const claimed = await readContract(body.chainId, "StarterDrip", chain.read).read.claimed([body.user]);
      if (claimed) throw new HttpError(HTTP_STATUS.conflict, "ALREADY_CLAIMED", "this account already claimed");
      return relay(ctx, chain, { kind: "claim", ...body, ipPrefix: prefix, deviceHash: device });
    });
    return sendRoute(reply, starterClaimRoute, result);
  });

  app.post(starterVoucherRoute.path, { config: { rateLimit: RELAY_RATE } }, async (request, reply) => {
    const { body } = parseRoute(starterVoucherRoute, request);
    const chain = chainOf(ctx, body.chainId);
    checkGeo(ctx, body.chainId, request);
    checkDeadline(body.deadline);
    const signed = await verifyVoucherSignature({ ...body, code: body.code });
    if (!signed) throw new HttpError(HTTP_STATUS.badRequest, "SIGNATURE_INVALID", "voucher signature does not match");
    const result = await once(`${body.chainId}:${body.user.toLowerCase()}:voucher`, () =>
      relay(ctx, chain, {
        kind: "voucher",
        ...body,
        ipPrefix: networkPrefix(request.ip),
        deviceHash: deviceOf(request),
      }),
    );
    return sendRoute(reply, starterVoucherRoute, result);
  });

  app.get(
    starterStatusRoute.path,
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { query } = parseRoute(starterStatusRoute, request);
      const chain = chainOf(ctx, query.chainId);
      const drip = readContract(query.chainId, "StarterDrip", chain.read);
      const [config, claimed, spentToday, budgetDay, redeemed] = await Promise.all([
        starterConfig(chain),
        drip.read.claimed([query.user], { blockTag: "finalized" }),
        drip.read.spentToday(),
        drip.read.budgetDay(),
        drip.read.vouchersRedeemed(),
      ]);
      const today = BigInt(Math.floor(Date.now() / MS_PER_SECOND / SECONDS_PER_DAY));
      const spent = budgetDay === today ? spentToday : 0n;
      const [row] = await ctx.db<ClaimRow[]>`
      SELECT * FROM starter_claims WHERE chain_id = ${query.chainId} AND user_address = ${query.user.toLowerCase()}
        AND kind <> 'topup'
      ORDER BY created_at DESC LIMIT 1`;
      const last = row ? await reconcileRelay(ctx, chain, row) : undefined;
      const next = await nextClaimAt(ctx, query.chainId, deviceOf(request), networkPrefix(request.ip));
      return sendRoute(reply, starterStatusRoute, {
        chainId: query.chainId,
        user: query.user as Address,
        claimed,
        practice: config.practiceAmount > 0n,
        dripWei: config.dripWei,
        practiceUsd6: config.practiceAmount,
        voucherUsd6: config.voucherAmount,
        vouchersLeft: Number(config.maxVouchers > redeemed ? config.maxVouchers - redeemed : 0n),
        budgetLeftWei: config.dailyBudgetWei > spent ? config.dailyBudgetWei - spent : 0n,
        nextClaimAt: next?.toISOString() ?? null,
        lastRelay: last ? relayFromRow(last) : null,
      });
    },
  );

  app.get(starterRelayRoute.path, async (request, reply) => {
    const { params } = parseRoute(starterRelayRoute, request);
    const [row] = await ctx.db<ClaimRow[]>`SELECT * FROM starter_claims WHERE id = ${params.relayId}`;
    if (!row) throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", "no such relay");
    return sendRoute(reply, starterRelayRoute, relayFromRow(row));
  });
}
