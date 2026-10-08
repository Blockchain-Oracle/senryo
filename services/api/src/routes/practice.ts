/**
 * `POST /v1/practice/perpl-funds` (real venues, Stage 1): "Get test money" for Perpl. The signed-in Practice user gets
 * Agora's test AUSD in their own wallet from the sponsor — no gas, no step-up — so the Perpl ticket can fund its
 * `createAccount`. One per address per day; skipped while the wallet already holds a full drip. Agora's faucet keeps
 * one cooldown for every caller, so calls run one at a time and a `MaxFrequencyExceeded` waits it out once.
 */
import { perplFundsRoute } from "@senryo/api-client";
import { type Address, readPerplWalletCollateral } from "@senryo/chain";
import { PERPL_TESTNET_FAUCET_CNS, PERPL_TESTNET_FAUCET_COOLDOWN_SEC, TESTNET_CHAIN_ID } from "@senryo/config";
import {
  HTTP_STATUS,
  HttpError,
  type HttpServer,
  MS_PER_SECOND,
  parseRoute,
  SECONDS_PER_DAY,
  sendRoute,
} from "@senryo/service-common";
import { type ApiContext, chainOf } from "../context.ts";
import { networkPrefix } from "../geo.ts";
import { relay } from "../starter.ts";
import { deviceOf, once } from "./starter.ts";

const FUNDS_RATE = { max: 6, timeWindow: "1 minute" } as const;
/** A wallet holding at least one drip doesn't need another yet. */
const ENOUGH_CNS = PERPL_TESTNET_FAUCET_CNS;

/** One faucet call at a time across the process (the faucet's cooldown is global, not per user). */
let faucetLane: Promise<unknown> = Promise.resolve();
function inLane<T>(work: () => Promise<T>): Promise<T> {
  const run = faucetLane.then(work, work);
  faucetLane = run.catch(() => undefined);
  return run;
}

const isBusy = (error: unknown) => error instanceof HttpError && error.code === "RELAYER_BUSY";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function registerPracticeRoutes(app: HttpServer, ctx: ApiContext): void {
  app.post(perplFundsRoute.path, { config: { rateLimit: FUNDS_RATE } }, async (request, reply) => {
    if (!ctx.sessions) throw new HttpError(HTTP_STATUS.unavailable, "NOT_DEPLOYED", "sessions not configured");
    const session = await ctx.sessions.require(request);
    const { body } = parseRoute(perplFundsRoute, request);
    if (body.chainId !== TESTNET_CHAIN_ID || session.chainId !== TESTNET_CHAIN_ID)
      throw new HttpError(HTTP_STATUS.badRequest, "BAD_REQUEST", "test dollars are Practice only");
    const chain = chainOf(ctx, body.chainId);
    const user = session.address as Address;

    const result = await once(`${body.chainId}:${user.toLowerCase()}:perpl-funds`, async () => {
      const [recent] = await ctx.db<{ created_at: Date }[]>`
        SELECT created_at FROM starter_claims
         WHERE chain_id = ${body.chainId} AND user_address = ${user.toLowerCase()} AND kind = 'perpl-funds'
           AND stage NOT IN ('reverted', 'abandoned') AND created_at > now() - interval '1 day'
         ORDER BY created_at DESC LIMIT 1`;
      if (recent) {
        const nextSec = Math.ceil(
          (recent.created_at.getTime() + SECONDS_PER_DAY * MS_PER_SECOND - Date.now()) / MS_PER_SECOND,
        );
        throw new HttpError(HTTP_STATUS.tooMany, "RATE_LIMITED", "today's test dollars are in", nextSec);
      }
      const held = (await readPerplWalletCollateral(chain.read, TESTNET_CHAIN_ID, user)).balance;
      if (held >= ENOUGH_CNS) throw new HttpError(HTTP_STATUS.conflict, "NOT_NEEDED", "your wallet has test AUSD");
      const send = () =>
        relay(ctx, chain, {
          kind: "perpl-funds",
          user,
          ipPrefix: networkPrefix(request.ip),
          deviceHash: deviceOf(request),
        });
      return inLane(async () => {
        try {
          return await send();
        } catch (error) {
          if (!isBusy(error)) throw error;
          // Another caller just used the shared faucet: wait its cooldown out once, then try again.
          await sleep(PERPL_TESTNET_FAUCET_COOLDOWN_SEC * MS_PER_SECOND);
          return send();
        }
      });
    });
    return sendRoute(reply, perplFundsRoute, result);
  });
}
