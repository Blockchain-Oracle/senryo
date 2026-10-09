import {
  addressOf,
  describeError,
  expireParlayCallData,
  finalizeParlayCallData,
  type Hex,
  type LegWindow,
  MULTICALL3,
  parlayChanges,
  proofOf,
  resolveLegsAndSettleData,
  sendTx,
  seriesOf,
  verifierOf,
} from "@senryo/chain";
import { admissionSecOf, feedIdOf } from "@senryo/config";
import {
  applyParlayChanges,
  archivedPrint,
  nowSec,
  type ParlayLegRow,
  type ParlayRow,
  parlaysToSettle,
  pendingParlayFills,
} from "@senryo/service-common";
import { FILL_STALE_SEC, PARLAYS_INTERVAL_MS, SETTLE_AFTER_SEC } from "../constants.ts";
import type { KeeperContext } from "../context.ts";
import type { Job } from "../runner.ts";

/**
 * Parlays (S8.5, D-293): the backup for fills (every leg's archived print of the instant, or a refund once a leg's
 * window is over or its print can't come), and the legs' verdicts — each ended leg window's close print from the
 * archive and `resolve` (or its void once the print can't come), then `settleParlay`, which decides the legs in close
 * order and pays the parlay once it is decided. Windows with calls are also settled by `settle`; both are idempotent.
 */
export function parlaysJob(ctx: KeeperContext): Job {
  return {
    name: "parlays",
    intervalMs: PARLAYS_INTERVAL_MS,
    run: async () => {
      const now = nowSec();
      for (const p of await pendingParlayFills(ctx.db, ctx.chainId, now, FILL_STALE_SEC)) {
        await guarded(ctx, p, () => backupFill(ctx, p, now));
      }
      for (const p of await parlaysToSettle(ctx.db, ctx.chainId, now, SETTLE_AFTER_SEC)) {
        await guarded(ctx, p, () => settle(ctx, p, now));
      }
    },
  };
}

async function guarded(ctx: KeeperContext, p: ParlayRow, work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (error) {
    ctx.log.warn({ parlayId: p.parlay_id.toString(), err: describeError(error) }, "parlay work failed; retrying");
  }
}

function marketOf(ctx: KeeperContext, leg: ParlayLegRow) {
  return seriesOf(ctx.chainId, leg.series_id as Hex)?.market;
}

async function backupFill(ctx: KeeperContext, p: ParlayRow & { legs: ParlayLegRow[] }, now: number): Promise<void> {
  const target = Number(p.target);
  const over = p.legs.some((l) => now >= Number(l.window_expiry));
  const prints = await Promise.all(
    p.legs.map(async (l) => {
      const market = marketOf(ctx, l);
      return market ? { market, print: await archivedPrint(ctx.db, feedIdOf(market), target) } : null;
    }),
  );
  const ready = !over && prints.every((x) => x?.print);
  const lapsed = prints.some((x) => x && !x.print && now > target + admissionSecOf(x.market));
  if (!ready && !over && !lapsed) return; // still printable: the gateway archives fill instants on demand
  const data = ready
    ? finalizeParlayCallData(
        p.parlay_id,
        prints.map((x) => (x?.print ? proofOf(x.market, x.print.updates) : "0x")),
      )
    : expireParlayCallData(p.parlay_id);
  await send(ctx, addressOf(ctx.chainId, "BandReserve"), data, p, ready ? "backup fill" : "expire");
}

async function settle(ctx: KeeperContext, p: ParlayRow & { legs: ParlayLegRow[] }, now: number): Promise<void> {
  const legs: LegWindow[] = [];
  for (const l of p.legs) {
    const expiry = Number(l.window_expiry);
    const market = marketOf(ctx, l);
    if (l.outcome !== "pending" || now < expiry + SETTLE_AFTER_SEC || !market) continue;
    const print = await archivedPrint(ctx.db, feedIdOf(market), expiry);
    if (!print && now <= expiry + admissionSecOf(market)) continue; // the close print is on its way
    legs.push({
      seriesId: l.series_id as Hex,
      windowId: l.window_id as Hex,
      start: Number(l.window_start),
      expiry,
      verifier: verifierOf(ctx.chainId, market),
      feedId: feedIdOf(market),
      proof: print ? proofOf(market, print.updates) : null,
    });
  }
  if (legs.length === 0) return;
  await send(ctx, MULTICALL3, resolveLegsAndSettleData(ctx.chainId, legs, [p.parlay_id]), p, "settle legs");
}

async function send(ctx: KeeperContext, to: Hex, data: Hex, p: ParlayRow, why: string): Promise<void> {
  const subject = `parlay ${p.parlay_id}`;
  const sent = await sendTx(ctx.sender, { to, data, action: "marketSettle", meta: { job: "parlays", why } });
  ctx.recent.add({ job: "parlays", subject, tx: sent.hash, stage: sent.stage });
  ctx.log.info({ actor: "keeper", why, parlayId: p.parlay_id.toString(), tx: sent.hash }, "parlay advanced");
  if (sent.stage === "reverted") throw new Error(`${why} reverted in ${sent.hash}`);
  const changes = parlayChanges(sent.receipt.logs, addressOf(ctx.chainId, "BandReserve"));
  await applyParlayChanges(ctx.db, ctx.chainId, changes, async () => [], sent.hash);
}
