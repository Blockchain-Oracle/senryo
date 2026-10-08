import { addressOf, type Hex, seriesOf } from "@senryo/chain";
import { bandReserveAbi, windowsAbi } from "@senryo/contracts/abis";
import type { Db } from "@senryo/service-common";
import { SYNC_BATCH, SYNC_INTERVAL_MS, SYNC_STALE_SEC } from "../constants.ts";
import type { KeeperContext } from "../context.ts";
import type { Job } from "../runner.ts";

/**
 * The ticket book follows the chain, not the other way round (D-278): any ticket id the services have not seen (a
 * commit relayed by someone else, or a relay whose answer timed out after broadcasting) is read from the reserve and
 * added, and tickets still open in the book are re-read when they go quiet. Batched contract reads only — never a log
 * scan — so the keeper's work list (fills, settlement, payouts) can't miss a ticket that holds someone's money.
 */
const STATUS = ["", "committed", "open", "closed", "settled", "refunded"] as const;

export function syncJob(ctx: KeeperContext): Job {
  return {
    name: "sync",
    intervalMs: SYNC_INTERVAL_MS,
    run: async () => {
      const reserve = addressOf(ctx.chainId, "BandReserve");
      const count = await ctx.read.readContract({ address: reserve, abi: bandReserveAbi, functionName: "ticketCount" });
      const [known] = await ctx.db<{ max: bigint | null }[]>`
        SELECT max(ticket_id) AS max FROM market_tickets WHERE chain_id = ${ctx.chainId}`;
      const missing: bigint[] = [];
      for (let id = (known?.max ?? 0n) + 1n; id <= count && missing.length < SYNC_BATCH; id += 1n) missing.push(id);
      const quiet = await ctx.db<{ ticket_id: bigint }[]>`
        SELECT ticket_id FROM market_tickets WHERE chain_id = ${ctx.chainId}
          AND state IN ('committed', 'open', 'closing') AND updated_at < now() - make_interval(secs => ${SYNC_STALE_SEC})
        ORDER BY ticket_id LIMIT ${SYNC_BATCH}`;
      const ids = [...missing, ...quiet.map((r) => r.ticket_id)];
      if (ids.length > 0) await reconcile(ctx, ctx.db, ids);
    },
  };
}

async function reconcile(ctx: KeeperContext, db: Db, ids: bigint[]): Promise<void> {
  const reserve = addressOf(ctx.chainId, "BandReserve");
  const windows = addressOf(ctx.chainId, "Windows");
  const tickets = await ctx.read.multicall({
    allowFailure: false,
    contracts: ids.map(
      (id) => ({ address: reserve, abi: bandReserveAbi, functionName: "ticketOf", args: [id] }) as const,
    ),
  });
  const windowIds = [...new Set(tickets.map((t) => t.windowId))];
  const wins = await ctx.read.multicall({
    allowFailure: false,
    contracts: windowIds.map(
      (id) => ({ address: windows, abi: windowsAbi, functionName: "windowOf", args: [id] }) as const,
    ),
  });
  const windowOf = new Map(windowIds.map((id, i) => [id, wins[i]]));
  for (const [i, t] of tickets.entries()) {
    const id = ids[i] as bigint;
    const w = windowOf.get(t.windowId);
    if (!w || !seriesOf(ctx.chainId, w.seriesId as Hex)) continue; // not one of our catalogue's series
    const state = t.status === 2 && t.closing > 0n ? "closing" : (STATUS[t.status] ?? "committed");
    const target = state === "committed" || state === "closing" ? t.target : null;
    await db`
      INSERT INTO market_tickets (chain_id, ticket_id, owner, window_id, series_id, window_start, window_expiry, band,
                                  state, target, stake, payout, entry_e8)
      VALUES (${ctx.chainId}, ${id}, ${t.owner.toLowerCase()}, ${t.windowId}, ${w.seriesId}, ${w.start}, ${w.expiry},
              ${t.band}, ${state}, ${target}, ${t.stake}, ${t.payout}, ${t.entryE8 === 0n ? null : t.entryE8})
      ON CONFLICT (chain_id, ticket_id) DO UPDATE SET
        state = EXCLUDED.state, target = EXCLUDED.target, stake = EXCLUDED.stake, payout = EXCLUDED.payout,
        entry_e8 = COALESCE(EXCLUDED.entry_e8, market_tickets.entry_e8), updated_at = now()`;
  }
}
