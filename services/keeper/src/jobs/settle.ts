import {
  addressOf,
  claimForCallData,
  describeError,
  type Hex,
  MULTICALL3,
  proofOf,
  sendTx,
  seriesOf,
  settleAndClaimData,
  ticketChanges,
  verifierOf,
  voidAndClaimData,
} from "@senryo/chain";
import { admissionSecOf, feedIdOf, MARKET_BATCH_MAX } from "@senryo/config";
import { applyTicketChanges, archivedPrint, nowSec, windowsToSettle } from "@senryo/service-common";
import { closeProof } from "../close-print.ts";
import { SETTLE_AFTER_SEC, SETTLE_INTERVAL_MS } from "../constants.ts";
import type { KeeperContext } from "../context.ts";
import type { Job } from "../runner.ts";

/**
 * Settlement and automatic payouts (D-264, D-278): every window past expiry that still has tickets gets one
 * transaction — its close print (from the archive), resolve, settle every band, and the first 32 payouts — then
 * further `claimFor` batches. A window whose print never reached the chain within admission voids and refunds
 * (`closeProof`: after admission an archived print no longer proves anything). A window whose last transaction changed
 * nothing waits before the next try (`ctx.stalls`). Correct even when late: the print is the archived unique print of
 * the instant, whenever this runs (CWF F-S10-01).
 */
export function settleJob(ctx: KeeperContext): Job {
  return {
    name: "settle",
    intervalMs: SETTLE_INTERVAL_MS,
    run: async () => {
      const now = nowSec();
      for (const w of await windowsToSettle(ctx.db, ctx.chainId, now, SETTLE_AFTER_SEC)) {
        if (ctx.stalls.blocked(w.window_id)) continue;
        try {
          await settleOne(ctx, w, now);
        } catch (error) {
          ctx.log.warn({ windowId: w.window_id, err: describeError(error) }, "settle failed; retrying next tick");
        }
      }
    },
  };
}

async function settleOne(
  ctx: KeeperContext,
  w: { window_id: string; series_id: string; window_expiry: bigint; ids: bigint[] },
  now: number,
): Promise<void> {
  const series = seriesOf(ctx.chainId, w.series_id as Hex);
  if (!series) return;
  const windowId = w.window_id as Hex;
  const expiry = Number(w.window_expiry);
  const [first, ...rest] = chunk(w.ids, MARKET_BATCH_MAX);
  const print = await archivedPrint(ctx.db, feedIdOf(series.market), expiry);
  const verifier = verifierOf(ctx.chainId, series.market);
  const feedId = feedIdOf(series.market);
  const close = await closeProof(ctx, {
    verifier,
    feedId,
    expiry,
    admissionSec: admissionSecOf(series.market),
    archived: print ? proofOf(series.market, print.updates) : null,
    now,
  });
  // "wait": the close print is not archived yet; the gateway writes it within a second of streaming.
  if (close.kind === "wait") return;
  const data =
    close.kind === "prove"
      ? settleAndClaimData(ctx.chainId, {
          windowId,
          expiry,
          verifier,
          feedId,
          closeProof: close.proof,
          ticketIds: first ?? [],
        })
      : voidAndClaimData(ctx.chainId, { windowId, ticketIds: first ?? [] });
  if (!(await send(ctx, MULTICALL3, data, windowId, w))) return;
  for (const ids of rest) {
    const claim = claimForCallData(ids);
    if (!(await send(ctx, addressOf(ctx.chainId, "BandReserve"), claim, windowId, w))) return;
  }
}

async function send(
  ctx: KeeperContext,
  to: Hex,
  data: Hex,
  windowId: Hex,
  w: { series_id: string; window_expiry: bigint },
): Promise<boolean> {
  const sent = await sendTx(ctx.sender, { to, data, action: "marketSettle", meta: { job: "settle", windowId } });
  ctx.recent.add({ job: "settle", subject: windowId, tx: sent.hash, stage: sent.stage });
  if (sent.stage === "reverted") throw new Error(`settle reverted in ${sent.hash}`);
  const wait = ctx.stalls.record(windowId, sent.receipt.logs.length > 0);
  if (wait > 0) {
    ctx.log.warn({ windowId, tx: sent.hash, waitMs: wait }, "settle changed nothing; waiting before retrying");
    return false;
  }
  ctx.log.info(
    { actor: "keeper", why: "settle", windowId, tx: sent.hash, stage: sent.stage },
    "window settled and paid",
  );
  const changes = ticketChanges(sent.receipt.logs, addressOf(ctx.chainId, "BandReserve"));
  const expiry = Number(w.window_expiry);
  await applyTicketChanges(
    ctx.db,
    ctx.chainId,
    changes,
    async () => ({
      windowId,
      seriesId: w.series_id as Hex,
      start: expiry - (seriesOf(ctx.chainId, w.series_id as Hex)?.cadenceSec ?? 0),
      expiry,
    }),
    sent.hash,
  );
  await ctx.notifyResults(changes);
  return true;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
