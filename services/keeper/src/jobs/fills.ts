import {
  addressOf,
  describeError,
  expireCallData,
  finalizeCallData,
  type Hex,
  printProof,
  sendTx,
  seriesOf,
  ticketChanges,
} from "@senryo/chain";
import { MARKET_BATCH_MAX } from "@senryo/config";
import { applyTicketChanges, archivedPrint, nowSec, pendingFills, type TicketRow } from "@senryo/service-common";
import { FILL_STALE_SEC, FILLS_INTERVAL_MS } from "../constants.ts";
import type { KeeperContext } from "../context.ts";
import type { Job } from "../runner.ts";

/**
 * The backup for fills (D-261): the relay finalizes within ~1 s of the print; anything still pending a few seconds
 * later (relay restart, a print that streamed late) is finalized here from the archive, and a call whose print can no
 * longer come — or whose window has ended — is refunded with `expire`. Never a different price: the archived print is
 * the unique print of the instant.
 */
export function fillsJob(ctx: KeeperContext): Job {
  return {
    name: "fills",
    intervalMs: FILLS_INTERVAL_MS,
    run: async () => {
      const now = nowSec();
      const groups = new Map<string, TicketRow[]>();
      for (const t of await pendingFills(ctx.db, ctx.chainId, now, FILL_STALE_SEC)) {
        const key = `${t.series_id}:${t.target}`;
        groups.set(key, [...(groups.get(key) ?? []), t]);
      }
      for (const rows of groups.values()) {
        try {
          await fillGroup(ctx, rows, now);
        } catch (error) {
          ctx.log.warn({ err: describeError(error) }, "backup fill failed; retrying next tick");
        }
      }
    },
  };
}

async function fillGroup(ctx: KeeperContext, rows: TicketRow[], now: number): Promise<void> {
  const head = rows[0];
  if (!head || head.target === null) return;
  const series = seriesOf(ctx.chainId, head.series_id as Hex);
  if (!series) return;
  const target = Number(head.target);
  const reserve = addressOf(ctx.chainId, "BandReserve");
  const print = await archivedPrint(ctx.db, series.market.pythFeedId, target);
  const windowOver = now >= Number(head.window_expiry);
  for (let i = 0; i < rows.length; i += MARKET_BATCH_MAX) {
    const ids = rows.slice(i, i + MARKET_BATCH_MAX).map((r) => r.ticket_id);
    let data: Hex;
    if (print && !windowOver) {
      data = finalizeCallData(target, ids, printProof(print.updates));
    } else if (windowOver) {
      data = expireCallData(ids);
    } else {
      return; // still printable: the gateway archives fills on demand; wait for the next tick
    }
    const action = windowOver ? "marketExpire" : "marketFinalize";
    const sent = await sendTx(ctx.sender, {
      to: reserve,
      data,
      action,
      meta: { job: "fills", target: String(target) },
    });
    ctx.recent.add({ job: "fills", subject: `${series.market.symbol}@${target}`, tx: sent.hash, stage: sent.stage });
    const changes = ticketChanges(sent.receipt.logs, reserve);
    await applyTicketChanges(ctx.db, ctx.chainId, changes, async (windowId) => ({
      windowId,
      seriesId: head.series_id as Hex,
      start: Number(head.window_start),
      expiry: Number(head.window_expiry),
    }));
  }
}
