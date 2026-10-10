import {
  catalogRoute,
  grantSessionRoute,
  intentStatusRoute,
  marketAccountRoute,
  practiceGrantRoute,
  revokeSessionRoute,
  setExitRoute,
  streamTicketRoute,
  submitIntentRoute,
  ticketsRoute,
  windowLoadRoute,
  withdrawRoute,
} from "@senryo/api-client";
import { addressOf, dollarTokenOf, type Hex, seriesIdOf, seriesOf } from "@senryo/chain";
import { bandMenu, type ChainId, feedIdOf, marketsOn, POOL_TERMS, sigmaE8Of } from "@senryo/config";
import { bandReserveAbi, testUSDAbi } from "@senryo/contracts/abis";
import type { HttpServer } from "@senryo/service-common";
import {
  type ExitRow,
  exitsOf,
  HTTP_STATUS,
  HttpError,
  nowSec,
  parseRoute,
  sendRoute,
  ticketsOf,
} from "@senryo/service-common";
import { type ApiContext, chainOf } from "../context.ts";
import { TICKETS_PAGE } from "../relay/constants.ts";
import { mintStreamTicket } from "../stream/ticket.ts";

/** The markets over HTTP (S3): catalogue, relayed calls and sessions, the caller's tickets, Practice dollars. */
const CONFIG_CACHE_MS = 10_000;
/** Withdrawals spend the sponsor's gas: a few a minute per client is plenty. */
const WITHDRAW_PER_MINUTE = 5;
const MINUTE_MS = 60_000;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const configCache = new Map<ChainId, { at: number; version: number }>();
/** A window's load moves with every fill: a second of cache absorbs a terminal crowd without going stale. */
const LOAD_CACHE_MS = 1_000;
/** Entries older than this many cache lifetimes are dropped (windows roll every minute). */
const LOAD_CACHE_KEEP = 120;
const loadCache = new Map<
  string,
  { at: number; value: { reservedByExpiry: bigint; liquid: bigint; reserved: bigint } }
>();

async function configVersion(ctx: ApiContext, chainId: ChainId): Promise<number> {
  const hit = configCache.get(chainId);
  if (hit && Date.now() - hit.at < CONFIG_CACHE_MS) return hit.version;
  const version = Number(
    await chainOf(ctx, chainId).read.readContract({
      address: addressOf(chainId, "BandReserve"),
      abi: bandReserveAbi,
      functionName: "configVersion",
    }),
  );
  configCache.set(chainId, { at: Date.now(), version });
  return version;
}

/** An exit as the apps show it: the trail's stop is its best bid less the trail, never under the floor. */
function exitView(e: ExitRow) {
  const trailStopE6 = e.trail_e6 > 0 && e.trail_peak_e6 > 0 ? Math.max(e.trail_peak_e6 - e.trail_e6, e.floor_e6) : null;
  return {
    takeProfitE6: e.take_profit_e6,
    stopLossE6: e.stop_loss_e6,
    floorE6: e.floor_e6,
    trailE6: e.trail_e6,
    trailStopE6,
    firedKind: e.fired_kind,
  };
}

function marketsOf(ctx: ApiContext, chainId: ChainId) {
  const m = ctx.markets.get(chainId);
  if (!m) throw new HttpError(HTTP_STATUS.unavailable, "NOT_DEPLOYED", `markets are not live on ${chainId}`);
  return m;
}

export function registerMarketRoutes(app: HttpServer, ctx: ApiContext): void {
  app.get(catalogRoute.path, async (request, reply) => {
    const { query } = parseRoute(catalogRoute, request);
    const chain = chainOf(ctx, query.chainId);
    const terms = POOL_TERMS[chain.chainId];
    reply.header("cache-control", "public, max-age=10");
    return sendRoute(reply, catalogRoute, {
      chainId: chain.chainId,
      deployed: chain.deployed,
      configVersion: await configVersion(ctx, chain.chainId),
      contracts: {
        reserve: addressOf(chain.chainId, "BandReserve"),
        windows: addressOf(chain.chainId, "Windows"),
        verifier: addressOf(chain.chainId, "PythPrintVerifier"),
        dollar: dollarTokenOf(chain.chainId) ?? addressOf(chain.chainId, "BandReserve"),
      },
      terms: {
        halfSpreadE6: terms.halfSpreadE6,
        minProbE6: terms.minProbE6,
        maxProbE6: terms.maxProbE6,
        maxSurchargeE6: terms.maxSurchargeE6,
        maxExpiryReserved: terms.maxExpiryReserved,
        maxExposureBps: terms.maxExposureBps,
        minStake: terms.minStake,
        maxStake: terms.maxStake,
        session: terms.session,
      },
      markets: marketsOn(chain.chainId).map((m) => ({
        symbol: m.symbol,
        name: m.name,
        kind: m.kind,
        feedId: feedIdOf(m),
        paused: ctx.gateway.pausedReason(m),
        members:
          m.source.kind === "basket" ? m.source.members.map(({ symbol, weightBps }) => ({ symbol, weightBps })) : [],
        series: m.cadences.map((cadenceSec) => ({
          cadenceSec,
          seriesId: seriesIdOf(m.symbol, cadenceSec),
          sigmaE8: sigmaE8Of(m),
          bands: bandMenu(m, cadenceSec).map((b, index) => ({ index, ...b })),
        })),
      })),
    });
  });

  app.post(
    submitIntentRoute.path,
    { config: { rateLimit: { max: 60, timeWindow: 60_000 } } },
    async (request, reply) => {
      const { body } = parseRoute(submitIntentRoute, request);
      const status = await marketsOf(ctx, body.chainId).relay.submit({ ...body, signature: body.signature as Hex });
      return sendRoute(reply, submitIntentRoute, status);
    },
  );

  app.get(intentStatusRoute.path, async (request, reply) => {
    const { params } = parseRoute(intentStatusRoute, request);
    for (const m of ctx.markets.values()) {
      const status = await m.relay.status(params.digest);
      if (status) return sendRoute(reply, intentStatusRoute, status);
    }
    throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", "no such call");
  });

  app.post(grantSessionRoute.path, async (request, reply) => {
    const { body } = parseRoute(grantSessionRoute, request);
    const result = await marketsOf(ctx, body.chainId).accounts.grantSession(body.grant, body.signature, body.permit);
    return sendRoute(reply, grantSessionRoute, result);
  });

  app.post(revokeSessionRoute.path, async (request, reply) => {
    const { body } = parseRoute(revokeSessionRoute, request);
    const result = await marketsOf(ctx, body.chainId).accounts.revoke(
      body.owner,
      body.nonce,
      body.deadline,
      body.signature,
    );
    return sendRoute(reply, revokeSessionRoute, result);
  });

  app.post(setExitRoute.path, async (request, reply) => {
    const { body } = parseRoute(setExitRoute, request);
    const result = await marketsOf(ctx, body.chainId).accounts.setExit(body.order, body.signature);
    return sendRoute(reply, setExitRoute, result);
  });

  app.post(
    withdrawRoute.path,
    { config: { rateLimit: { max: WITHDRAW_PER_MINUTE, timeWindow: MINUTE_MS } } },
    async (request, reply) => {
      const { body } = parseRoute(withdrawRoute, request);
      const result = await marketsOf(ctx, body.chainId).accounts.withdraw(body.authorization, body.signature);
      return sendRoute(reply, withdrawRoute, result);
    },
  );

  app.get(ticketsRoute.path, async (request, reply) => {
    const { query } = parseRoute(ticketsRoute, request);
    const rows = await ticketsOf(ctx.db, query.chainId, query.owner, TICKETS_PAGE);
    const exits = new Map(
      (
        await exitsOf(
          ctx.db,
          query.chainId,
          rows.map((r) => r.ticket_id),
        )
      ).map((e) => [e.ticket_id, exitView(e)]),
    );
    return sendRoute(reply, ticketsRoute, {
      tickets: rows.flatMap((r) => {
        const series = seriesOf(query.chainId, r.series_id as Hex);
        if (!series) return [];
        return [
          {
            ticketId: r.ticket_id,
            windowId: r.window_id as Hex,
            symbol: series.market.symbol,
            cadenceSec: series.cadenceSec,
            start: Number(r.window_start),
            band: r.band,
            state: r.state as "committed",
            stake: r.stake,
            payout: r.payout,
            entryE8: r.entry_e8,
            result: r.result,
            outcome: r.outcome as "win" | null,
            exit: exits.get(r.ticket_id) ?? null,
            updatedAt: r.updated_at.toISOString(),
          },
        ];
      }),
    });
  });

  app.get(windowLoadRoute.path, async (request, reply) => {
    const { query } = parseRoute(windowLoadRoute, request);
    const chain = chainOf(ctx, query.chainId);
    const key = `${chain.chainId}:${query.expiry}`;
    let hit = loadCache.get(key);
    if (!hit || Date.now() - hit.at >= LOAD_CACHE_MS) {
      const reserve = addressOf(chain.chainId, "BandReserve");
      const [reservedByExpiry, liquid, reserved] = await chain.read.multicall({
        allowFailure: false,
        contracts: [
          { address: reserve, abi: bandReserveAbi, functionName: "reservedByExpiry", args: [query.expiry] },
          { address: reserve, abi: bandReserveAbi, functionName: "liquid" },
          { address: reserve, abi: bandReserveAbi, functionName: "reserved" },
        ],
      });
      hit = { at: Date.now(), value: { reservedByExpiry, liquid, reserved } };
      loadCache.set(key, hit);
      for (const [k, v] of loadCache) if (Date.now() - v.at > LOAD_CACHE_MS * LOAD_CACHE_KEEP) loadCache.delete(k);
    }
    reply.header("cache-control", "public, max-age=1");
    return sendRoute(reply, windowLoadRoute, { expiry: query.expiry, ...hit.value });
  });

  app.get(marketAccountRoute.path, async (request, reply) => {
    const { query } = parseRoute(marketAccountRoute, request);
    const chain = chainOf(ctx, query.chainId);
    const reserve = addressOf(chain.chainId, "BandReserve");
    const dollar = dollarTokenOf(chain.chainId);
    if (!dollar) throw new HttpError(HTTP_STATUS.unavailable, "NOT_DEPLOYED", "no dollar on this network");
    const [balance, allowance, permitNonce, epoch, session] = await chain.read.multicall({
      allowFailure: false,
      contracts: [
        { address: dollar, abi: testUSDAbi, functionName: "balanceOf", args: [query.owner] },
        { address: dollar, abi: testUSDAbi, functionName: "allowance", args: [query.owner, reserve] },
        { address: dollar, abi: testUSDAbi, functionName: "nonces", args: [query.owner] },
        { address: reserve, abi: bandReserveAbi, functionName: "epochOf", args: [query.owner] },
        { address: reserve, abi: bandReserveAbi, functionName: "sessionOf", args: [query.owner] },
      ],
    });
    const live = session.delegate !== ZERO_ADDRESS && session.epoch === epoch && session.expiry > nowSec();
    return sendRoute(reply, marketAccountRoute, {
      balance,
      allowance,
      permitNonce,
      epoch,
      session: live
        ? {
            delegate: session.delegate,
            expiry: session.expiry,
            perCallCap: session.perCallCap,
            sessionCap: session.sessionCap,
            spent: session.spent,
          }
        : null,
    });
  });

  app.post(streamTicketRoute.path, async (request, reply) => {
    const session = await ctx.sessions?.require(request);
    if (!session || !ctx.secrets.sessionSecret) {
      throw new HttpError(HTTP_STATUS.unavailable, "NOT_DEPLOYED", "sessions not configured");
    }
    const minted = mintStreamTicket(ctx.secrets.sessionSecret, session.address, nowSec());
    return sendRoute(reply, streamTicketRoute, minted);
  });

  app.post(
    practiceGrantRoute.path,
    { config: { rateLimit: { max: 5, timeWindow: 60_000 } } },
    async (request, reply) => {
      const session = await ctx.sessions?.require(request);
      if (!session) throw new HttpError(HTTP_STATUS.unavailable, "NOT_DEPLOYED", "sessions not configured");
      const result = await marketsOf(ctx, session.chainId).accounts.practiceGrant(session.address);
      return sendRoute(reply, practiceGrantRoute, result);
    },
  );
}
