import { addressOf, describeError, type Hex, proofOf, rideChanges, sendTx, settleBoundsCallData } from "@senryo/chain";
import { admissionSecOf, feedIdOf, rideMarketSpec } from "@senryo/config";
import { ridePastCap, ridePastKo, toE8 } from "@senryo/core";
import { applyRideChanges, archivedPrint, nowSec, type RideRow } from "@senryo/service-common";
import { BOUNDS_INTERVAL_MS, BOUNDS_MARGIN_SEC, RIDE_BATCH_MAX } from "../constants.ts";
import type { KeeperContext } from "../context.ts";
import type { Job } from "../runner.ts";

/**
 * Bounds (R4.3, D-301): the relay's bound watcher settles a crossing within a second of it; this sweep is its backup,
 * from the archive. For each ride market with open rides, the archived prints still inside their admission (minute
 * boundaries, every fill and end instant, and each crossing the relay archived on its way) are checked oldest first,
 * and at the first that crosses any open ride's knock-out or cap, every ride it crossed is settled there.
 */
export function boundsJob(ctx: KeeperContext): Job {
  return {
    name: "bounds",
    intervalMs: BOUNDS_INTERVAL_MS,
    run: async () => {
      const now = nowSec();
      const open = await ctx.db<RideRow[]>`SELECT * FROM market_rides WHERE chain_id = ${ctx.chainId}
        AND state IN ('open', 'closing') AND ko_e8 IS NOT NULL ORDER BY ride_id`;
      const byMarket = new Map<number, RideRow[]>();
      for (const r of open) byMarket.set(r.market_id, [...(byMarket.get(r.market_id) ?? []), r]);
      for (const [marketId, rides] of byMarket) {
        try {
          await sweep(ctx, marketId, rides, now);
        } catch (error) {
          ctx.log.warn({ marketId, err: describeError(error) }, "bound sweep failed; retrying next tick");
        }
      }
    },
  };
}

async function sweep(ctx: KeeperContext, marketId: number, rides: RideRow[], now: number): Promise<void> {
  const market = rideMarketSpec(marketId);
  if (!market) return;
  const feedId = feedIdOf(market);
  const since = now - admissionSecOf(market) + BOUNDS_MARGIN_SEC;
  const prints = await ctx.db<{ t: bigint; price: bigint; expo: number }[]>`
    SELECT t, price, expo FROM pyth_prints WHERE feed_id = ${feedId} AND t > ${since} ORDER BY t`;
  for (const p of prints) {
    const t = Number(p.t);
    const e8 = toE8(p.price, p.expo);
    const crossed = rides.filter(
      (r) =>
        r.ko_e8 !== null &&
        r.cap_e8 !== null &&
        r.filled_at !== null &&
        t >= Number(r.filled_at) &&
        (r.end_at === null || t <= Number(r.end_at)) &&
        (ridePastKo(r.is_long, e8, r.ko_e8) || ridePastCap(r.is_long, e8, r.cap_e8)),
    );
    if (crossed.length === 0) continue;
    const print = await archivedPrint(ctx.db, feedId as Hex, t);
    if (!print) return;
    const reserve = addressOf(ctx.chainId, "BandReserve");
    for (let i = 0; i < crossed.length; i += RIDE_BATCH_MAX) {
      const ids = crossed.slice(i, i + RIDE_BATCH_MAX).map((r) => r.ride_id);
      const sent = await sendTx(ctx.sender, {
        to: reserve,
        data: settleBoundsCallData(t, ids, proofOf(market, print.updates)),
        action: "rideBounds",
        meta: { job: "bounds", t: String(t) },
      });
      await applyRideChanges(ctx.db, ctx.chainId, rideChanges(sent.receipt.logs, reserve), sent.hash);
      ctx.recent.add({ job: "bounds", subject: `${market.symbol}@${t}`, tx: sent.hash, stage: sent.stage });
      ctx.log.info({ actor: "keeper", why: "ride bound", t, rides: ids.length, tx: sent.hash }, "the relay had not");
    }
    return;
  }
}
