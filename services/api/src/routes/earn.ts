import { type EarnView, earnRequestRoute, earnRoute } from "@senryo/api-client";
import { type Address, addressOf, dollarTokenOf, earnDeployed, type Hex } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import { bandReserveAbi, poolSharesAbi, testUSDAbi } from "@senryo/contracts/abis";
import { HTTP_STATUS, HttpError, type HttpServer, nowSec, parseRoute, sendRoute } from "@senryo/service-common";
import type { ApiContext } from "../context.ts";

/**
 * Earn over HTTP (S7.6, D-287): the pool and one account read on chain in two multicalls (a few seconds of cache for
 * the pool), and signed requests relayed from the owner's lane. The apps make no RPC calls (D-280).
 */
const HOUR_SEC = 3600;
const POOL_CACHE_MS = 5_000;
const poolCache = new Map<ChainId, { at: number; value: NonNullable<EarnView["pool"]> }>();

async function readPool(ctx: ApiContext, chainId: ChainId): Promise<NonNullable<EarnView["pool"]>> {
  const hit = poolCache.get(chainId);
  if (hit && Date.now() - hit.at < POOL_CACHE_MS) return hit.value;
  const read = chainOrThrow(ctx, chainId).read;
  const shares = { address: addressOf(chainId, "PoolShares"), abi: poolSharesAbi } as const;
  const reserve = { address: addressOf(chainId, "BandReserve"), abi: bandReserveAbi } as const;
  const [supply, lastRoll, liquid, reserved, params] = await read.multicall({
    allowFailure: false,
    contracts: [
      { ...shares, functionName: "totalSupply" },
      { ...shares, functionName: "lastRoll" },
      { ...reserve, functionName: "liquid" },
      { ...reserve, functionName: "reserved" },
      { ...reserve, functionName: "params" },
    ],
  });
  const now = nowSec();
  const value = {
    value: liquid + reserved,
    liquid,
    reserved,
    supply,
    lastRoll: Number(lastRoll),
    nextRoll: Math.max(Number(lastRoll), now - (now % HOUR_SEC)) + HOUR_SEC,
    maxExposureBps: Number(params[4]),
  };
  poolCache.set(chainId, { at: Date.now(), value });
  return value;
}

async function readAccount(
  ctx: ApiContext,
  chainId: ChainId,
  owner: Address,
): Promise<NonNullable<EarnView["account"]>> {
  const read = chainOrThrow(ctx, chainId).read;
  const shares = { address: addressOf(chainId, "PoolShares"), abi: poolSharesAbi } as const;
  const dollar = dollarTokenOf(chainId);
  if (!dollar) throw new HttpError(HTTP_STATUS.unavailable, "NOT_DEPLOYED", `no dollar on ${chainId}`);
  const usd = { address: dollar, abi: testUSDAbi } as const;
  const [balance, value, supplyReq, withdrawReq, allowance, permitNonce] = await read.multicall({
    allowFailure: false,
    contracts: [
      { ...shares, functionName: "balanceOf", args: [owner] },
      { ...shares, functionName: "valueOf", args: [owner] },
      { ...shares, functionName: "supplyOf", args: [owner] },
      { ...shares, functionName: "withdrawOf", args: [owner] },
      { ...usd, functionName: "allowance", args: [owner, shares.address] },
      { ...usd, functionName: "nonces", args: [owner] },
    ],
  });
  const [supplyBatch, withdrawBatch] = await read.multicall({
    allowFailure: false,
    contracts: [
      { ...shares, functionName: "supplyBatch", args: [supplyReq[0]] },
      { ...shares, functionName: "withdrawBatch", args: [withdrawReq[0]] },
    ],
  });
  return {
    shares: balance,
    value,
    supply: { amount: supplyReq[1], settled: supplyReq[1] > 0n && supplyBatch[3] },
    withdraw: { amount: withdrawReq[1], settled: withdrawReq[1] > 0n && withdrawBatch[3] },
    allowance,
    permitNonce,
  };
}

function chainOrThrow(ctx: ApiContext, chainId: ChainId) {
  const chain = ctx.chains.get(chainId);
  if (!chain) throw new HttpError(HTTP_STATUS.unavailable, "NOT_DEPLOYED", `no chain ${chainId}`);
  return chain;
}

export function registerEarnRoutes(app: HttpServer, ctx: ApiContext): void {
  app.get(earnRoute.path, async (request, reply) => {
    const { query } = parseRoute(earnRoute, request);
    if (!earnDeployed(query.chainId))
      return sendRoute(reply, earnRoute, { deployed: false, pool: null, account: null });
    const [pool, account] = await Promise.all([
      readPool(ctx, query.chainId),
      query.owner ? readAccount(ctx, query.chainId, query.owner) : Promise.resolve(null),
    ]);
    reply.header("cache-control", "no-store");
    return sendRoute(reply, earnRoute, { deployed: true, pool, account });
  });

  app.post(earnRequestRoute.path, async (request, reply) => {
    const { body } = parseRoute(earnRequestRoute, request);
    const m = ctx.markets.get(body.chainId);
    if (!m || !earnDeployed(body.chainId)) {
      throw new HttpError(HTTP_STATUS.unavailable, "NOT_DEPLOYED", `Earn is not live on ${body.chainId}`);
    }
    const r = { ...body.request, kind: body.request.kind as 1 | 2 | 3 | 4 };
    const result = await m.accounts.earn(r, body.signature as Hex, body.permit);
    return sendRoute(reply, earnRequestRoute, result);
  });
}
