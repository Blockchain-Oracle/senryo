import {
  addressOf,
  describeError,
  expireRidesCallData,
  finalizeRidesCallData,
  type Hex,
  proofOf,
  RIDE_STATE,
  rideChanges,
  sendTx,
  settleEndsCallData,
} from "@senryo/chain";
import { admissionSecOf, feedIdOf, RIDE_TERMS, rideMarketSpec } from "@senryo/config";
import { bandReserveAbi } from "@senryo/contracts/abis";
import { applyRideChanges, archivedPrint, nowSec, type RideRow } from "@senryo/service-common";
import {
  FILL_STALE_SEC,
  RIDE_BATCH_MAX,
  RIDES_INTERVAL_MS,
  SETTLE_AFTER_SEC,
  SYNC_BATCH,
  SYNC_STALE_SEC,
} from "../constants.ts";
import type { KeeperContext } from "../context.ts";
import type { Job } from "../runner.ts";

/**
 * Rides (R4.3, D-299): the keeper's backup for everything the relay does first, from the archive.
 *  - **Sync:** any ride id the services haven't seen (committed by someone else, or a relay answer lost) is read from
 *    the reserve and added; live rides that went quiet are re-read — batched `rideOf` reads, never a log scan.
 *  - **Fills:** an open or close still pending a few seconds after its print is filled from the archived print; one
 *    whose print can no longer come (past its admission) is expired — an open refunded, a close dropped.
 *  - **Ends of life:** a ride still open at its end settles at that print (`settleEnds`), its bound if the print
 *    crossed one, else its equity there.
 */
const STATE = ["", "committed", "open", "closed", "knocked_out", "capped", "ended", "refunded"] as const;

export function ridesJob(ctx: KeeperContext): Job {
  return {
    name: "rides",
    intervalMs: RIDES_INTERVAL_MS,
    run: async () => {
      await sync(ctx);
      const now = nowSec();
      const rows = await ctx.db<RideRow[]>`SELECT * FROM market_rides WHERE chain_id = ${ctx.chainId}
        AND ((state IN ('committed', 'closing') AND target < ${now - FILL_STALE_SEC})
          OR (state IN ('open', 'closing') AND end_at < ${now - SETTLE_AFTER_SEC}))
        ORDER BY ride_id`;
      const pending = groupBy(
        rows.filter((r) => r.target !== null && Number(r.target) < now - FILL_STALE_SEC),
        (r) => `${r.market_id}:${r.target}`,
      );
      const ending = groupBy(
        rows.filter((r) => r.end_at !== null && Number(r.end_at) < now - SETTLE_AFTER_SEC),
        (r) => `${r.market_id}:${r.end_at}`,
      );
      for (const group of ending.values()) await work(ctx, "end", group, now);
      for (const group of pending.values()) await work(ctx, "fill", group, now);
    },
  };
}

function groupBy<T>(items: readonly T[], key: (t: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const t of items) out.set(key(t), [...(out.get(key(t)) ?? []), t]);
  return out;
}

async function work(ctx: KeeperContext, kind: "fill" | "end", rides: RideRow[], now: number): Promise<void> {
  const head = rides[0];
  const market = head && rideMarketSpec(head.market_id);
  const t = Number(kind === "fill" ? head?.target : head?.end_at);
  if (!head || !market || !t) return;
  try {
    const print = await archivedPrint(ctx.db, feedIdOf(market), t);
    const lapsed = !print && now > t + admissionSecOf(market);
    if (!print && !lapsed) return; // the gateway archives these instants; wait for it
    const reserve = addressOf(ctx.chainId, "BandReserve");
    for (let i = 0; i < rides.length; i += RIDE_BATCH_MAX) {
      const ids = rides.slice(i, i + RIDE_BATCH_MAX).map((r) => r.ride_id);
      let data: Hex;
      let action: "rideFinalize" | "rideExpire" | "rideEnds";
      if (print) {
        const proof = proofOf(market, print.updates);
        data = kind === "fill" ? finalizeRidesCallData(t, ids, proof) : settleEndsCallData(t, ids, proof);
        action = kind === "fill" ? "rideFinalize" : "rideEnds";
      } else if (kind === "fill") {
        data = expireRidesCallData(ids);
        action = "rideExpire";
      } else {
        // An end whose print was never recorded within its admission can't settle here; the ride is re-read.
        ctx.log.error({ market: market.symbol, end: t, rides: ids.length }, "a ride end's print is gone");
        return;
      }
      const sent = await sendTx(ctx.sender, { to: reserve, data, action, meta: { job: "rides", t: String(t) } });
      await applyRideChanges(ctx.db, ctx.chainId, rideChanges(sent.receipt.logs, reserve), sent.hash);
      ctx.recent.add({ job: "rides", subject: `${market.symbol} ${kind}@${t}`, tx: sent.hash, stage: sent.stage });
      ctx.log.info({ actor: "keeper", why: `ride ${action}`, t, rides: ids.length, tx: sent.hash }, "ride backup sent");
    }
  } catch (error) {
    ctx.log.warn({ kind, t, err: describeError(error) }, "ride backup failed; retrying next tick");
  }
}

/** New ride ids and quiet live rides, read from the reserve and written over the book (the chain decides). */
async function sync(ctx: KeeperContext): Promise<void> {
  const reserve = addressOf(ctx.chainId, "BandReserve");
  const count = await ctx.read.readContract({ address: reserve, abi: bandReserveAbi, functionName: "rideCount" });
  const [known] = await ctx.db<{ max: bigint | null }[]>`
    SELECT max(ride_id) AS max FROM market_rides WHERE chain_id = ${ctx.chainId}`;
  const ids: bigint[] = [];
  for (let id = (known?.max ?? 0n) + 1n; id <= count && ids.length < SYNC_BATCH; id += 1n) ids.push(id);
  const quiet = await ctx.db<{ ride_id: bigint }[]>`
    SELECT ride_id FROM market_rides WHERE chain_id = ${ctx.chainId}
      AND state IN ('committed', 'open', 'closing') AND updated_at < now() - make_interval(secs => ${SYNC_STALE_SEC})
    ORDER BY ride_id LIMIT ${SYNC_BATCH}`;
  ids.push(...quiet.map((r) => r.ride_id));
  if (ids.length === 0) return;
  const rides = await ctx.read.multicall({
    allowFailure: false,
    contracts: ids.map(
      (id) => ({ address: reserve, abi: bandReserveAbi, functionName: "rideOf", args: [id] }) as const,
    ),
  });
  const life = RIDE_TERMS[ctx.chainId].maxLifeSec;
  for (const [i, r] of rides.entries()) {
    const id = ids[i] as bigint;
    const state = r.status === RIDE_STATE.open && r.closing > 0n ? "closing" : (STATE[r.status] ?? "committed");
    const pending = state === "committed" || state === "closing";
    const filled = r.filledAt === 0 ? null : r.filledAt;
    await ctx.db`
      INSERT INTO market_rides (chain_id, ride_id, owner, market_id, is_long, state, margin, leverage_bps, open_fee,
                                target, limit_e8, closing, entry_e8, size, reserve, ko_e8, cap_e8, filled_at, end_at)
      VALUES (${ctx.chainId}, ${id}, ${r.owner.toLowerCase()}, ${r.marketId}, ${r.isLong}, ${state}, ${r.margin},
              ${r.leverageBps}, ${r.openFee}, ${pending ? r.target : null}, ${pending ? r.limitE8 : null},
              ${r.closing.toString()}, ${filled === null ? null : r.entryE8}, ${r.size.toString()}, ${r.reserve},
              ${filled === null ? null : r.koE8}, ${filled === null ? null : r.capE8}, ${filled},
              ${filled === null ? null : filled + life})
      ON CONFLICT (chain_id, ride_id) DO UPDATE SET
        state = EXCLUDED.state, margin = EXCLUDED.margin, open_fee = EXCLUDED.open_fee, target = EXCLUDED.target,
        limit_e8 = EXCLUDED.limit_e8, closing = EXCLUDED.closing, size = EXCLUDED.size, reserve = EXCLUDED.reserve,
        entry_e8 = COALESCE(EXCLUDED.entry_e8, market_rides.entry_e8), ko_e8 = COALESCE(EXCLUDED.ko_e8, market_rides.ko_e8),
        cap_e8 = COALESCE(EXCLUDED.cap_e8, market_rides.cap_e8),
        filled_at = COALESCE(EXCLUDED.filled_at, market_rides.filled_at),
        end_at = COALESCE(EXCLUDED.end_at, market_rides.end_at), updated_at = now()`;
  }
}
