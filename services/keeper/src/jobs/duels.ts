import {
  addressOf,
  type DuelStep,
  describeError,
  duelChanges,
  duelStepsData,
  type Hex,
  isDeployed,
  MULTICALL3,
  readDuelState,
  sendTx,
  windowSettled,
} from "@senryo/chain";
import { DUEL } from "@senryo/config";
import {
  adoptOpening,
  applyDuelChanges,
  type DuelWithPicks,
  duelWork,
  nowSec,
  staleOpenings,
} from "@senryo/service-common";
import { DUEL_OPENING_STALE_SEC, DUEL_WORK_BATCH, DUELS_INTERVAL_MS, SETTLE_AFTER_SEC } from "../constants.ts";
import type { KeeperContext } from "../context.ts";
import type { Job } from "../runner.ts";

/**
 * Duels (S8.6, D-294): every match the api opened is carried to its end here — a deck never revealed is refunded after
 * the arena's window; picks lock at the deadline (a seat short forfeits, both short send the pots home); each card's
 * calls are settled into the players' totals once the `settle` job has settled its window; then the pot. One
 * Multicall3 batch per match, each step allowed to fail (someone may have done it); the arena's events drive the book.
 */
export function duelsJob(ctx: KeeperContext): Job {
  return {
    name: "duels",
    intervalMs: DUELS_INTERVAL_MS,
    run: async () => {
      if (!isDeployed(ctx.chainId, "DuelArena")) return;
      for (const o of await staleOpenings(ctx.db, ctx.chainId, DUEL_OPENING_STALE_SEC)) {
        await guarded(ctx, o.match_id, () => adopt(ctx, o.match_id as Hex));
      }
      const now = nowSec();
      for (const m of await duelWork(ctx.db, ctx.chainId, DUEL_WORK_BATCH)) {
        await guarded(ctx, m.match_id, () => advance(ctx, m, now));
      }
    },
  };
}

async function guarded(ctx: KeeperContext, matchId: string, work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (error) {
    ctx.log.warn({ match: matchId, err: describeError(error) }, "duel work failed; retrying");
  }
}

async function adopt(ctx: KeeperContext, matchId: Hex): Promise<void> {
  const chain = await readDuelState(ctx.read, ctx.chainId, matchId);
  await adoptOpening(ctx.db, ctx.chainId, matchId, chain.state === "none" ? null : chain.revealBy);
}

/** Seats that picked every card. */
const completeSeats = (m: DuelWithPicks) =>
  [0, 1].filter((seat) => m.picks.filter((p) => p.seat === seat).length === DUEL.cards).length;

async function advance(ctx: KeeperContext, m: DuelWithPicks, now: number): Promise<void> {
  const matchId = m.match_id as Hex;
  const steps: DuelStep[] = [];
  if (m.state === "sealed") {
    if (m.reveal_by !== null && now > Number(m.reveal_by)) steps.push({ kind: "refundUnrevealed", matchId });
    return send(ctx, matchId, steps);
  }
  // A pot is decided when the picks are complete, or locked with at least one seat complete (else it went home).
  let potOpen = m.state === "settling" || m.state === "forfeited";
  if (m.state === "picking") {
    if (m.pick_deadline === null || now <= Number(m.pick_deadline)) return;
    steps.push({ kind: "lockPicks", matchId });
    potOpen = completeSeats(m) > 0;
  }
  let cardsDone = true;
  const waiting = new Set(m.picks.filter((p) => p.returned === null).map((p) => p.card));
  for (const card of waiting) {
    const c = m.cards[card];
    const ready = c && now >= c.expiry + SETTLE_AFTER_SEC && (await windowSettled(ctx.read, ctx.chainId, c.windowId));
    if (ready) steps.push({ kind: "settleCard", matchId, card });
    else cardsDone = false;
  }
  if (potOpen && cardsDone) steps.push({ kind: "finalize", matchId });
  return send(ctx, matchId, steps);
}

async function send(ctx: KeeperContext, matchId: Hex, steps: DuelStep[]): Promise<void> {
  if (steps.length === 0) return;
  const why = steps.map((s) => s.kind).join("+");
  const sent = await sendTx(ctx.sender, {
    to: MULTICALL3,
    data: duelStepsData(ctx.chainId, steps),
    action: "duelSettle",
    meta: { job: "duels", why },
  });
  ctx.recent.add({ job: "duels", subject: `duel ${matchId.slice(0, 10)}`, tx: sent.hash, stage: sent.stage });
  ctx.log.info({ actor: "keeper", why, match: matchId, tx: sent.hash }, "duel advanced");
  if (sent.stage === "reverted") throw new Error(`${why} reverted in ${sent.hash}`);
  const changes = duelChanges(sent.receipt.logs, addressOf(ctx.chainId, "DuelArena"));
  await applyDuelChanges(ctx.db, ctx.chainId, changes, sent.hash);
}
