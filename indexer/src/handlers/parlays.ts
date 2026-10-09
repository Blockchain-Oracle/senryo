import { type EvmOnEventContext, indexer, type Parlay } from "envio";
import { dayOf, finishOnAccount, key, newAccount, newDaily, type Outcome } from "../lib/records.ts";

/**
 * Parlays (contracts/src/markets/ParlayBook.sol, D-293): the parlay, its legs' outcomes as they are decided, and the
 * caller's record — a parlay counts as one call once it fills and realises its result when it settles, like a ticket.
 */
const OUTCOMES: Outcome[] = ["lose", "win", "refund"];
const LEG_NAMES = ["pending", "won", "tied", "lost", "void"];

type Ctx = EvmOnEventContext;

async function count(context: Ctx, chainId: number, owner: string, stake: bigint, at: number) {
  const accountId = key(chainId, owner);
  const a = (await context.Account.get(accountId)) ?? newAccount(chainId, owner);
  context.Account.set({
    ...a,
    calls: a.calls + 1,
    staked: a.staked + stake,
    lastActiveAt: Math.max(a.lastActiveAt, at),
  });
  const day = dayOf(at);
  const d = (await context.DailyAccountStat.get(`${accountId}_${day}`)) ?? newDaily(chainId, owner, day);
  context.DailyAccountStat.set({ ...d, calls: d.calls + 1, staked: d.staked + stake });
}

async function finish(context: Ctx, chainId: number, p: Parlay, amount: bigint, outcome: Outcome, at: number) {
  const pnl = amount - p.stake;
  const accountId = key(chainId, p.owner);
  const a = (await context.Account.get(accountId)) ?? newAccount(chainId, p.owner);
  context.Account.set(finishOnAccount({ ...a, returned: a.returned + amount }, pnl, outcome, at));
  const day = dayOf(at);
  const d = (await context.DailyAccountStat.get(`${accountId}_${day}`)) ?? newDaily(chainId, p.owner, day);
  context.DailyAccountStat.set({ ...d, pnl: d.pnl + pnl, wins: d.wins + (outcome === "win" ? 1 : 0) });
}

indexer.onEvent({ contract: "BandReserve", event: "ParlayCommitted" }, async ({ event, context }) => {
  const p = event.params;
  context.Parlay.set({
    id: key(event.chainId, p.parlayId),
    chainId: event.chainId,
    parlayId: p.parlayId,
    owner: p.owner,
    status: "committed",
    stake: p.stake,
    payout: 0n,
    chanceE6: undefined,
    legOutcomes: [],
    outcome: undefined,
    returned: 0n,
    viaSession: p.viaSession,
    committedAt: event.block.timestamp,
    committedTx: event.transaction.hash,
    settledAt: undefined,
    settleTx: undefined,
  });
});

indexer.onEvent({ contract: "BandReserve", event: "ParlayFilled" }, async ({ event, context }) => {
  const p = await context.Parlay.get(key(event.chainId, event.params.parlayId));
  if (!p) return;
  context.Parlay.set({
    ...p,
    status: "open",
    payout: event.params.payout,
    chanceE6: Number(event.params.chanceE6),
  });
  await count(context, event.chainId, p.owner, p.stake, event.block.timestamp);
});

indexer.onEvent({ contract: "BandReserve", event: "ParlayRefused" }, async ({ event, context }) => {
  const p = await context.Parlay.get(key(event.chainId, event.params.parlayId));
  if (!p) return;
  context.Parlay.set({ ...p, status: "refunded", outcome: "refund", returned: event.params.refunded });
});

indexer.onEvent({ contract: "BandReserve", event: "ParlayLegDecided" }, async ({ event, context }) => {
  const p = await context.Parlay.get(key(event.chainId, event.params.parlayId));
  if (!p) return;
  const legs = [...p.legOutcomes];
  const leg = Number(event.params.leg);
  while (legs.length <= leg) legs.push("pending");
  legs[leg] = LEG_NAMES[Number(event.params.outcome)] ?? "pending";
  context.Parlay.set({ ...p, legOutcomes: legs });
});

indexer.onEvent({ contract: "BandReserve", event: "ParlaySettled" }, async ({ event, context }) => {
  const p = await context.Parlay.get(key(event.chainId, event.params.parlayId));
  if (!p) return;
  const outcome = OUTCOMES[Number(event.params.outcome)] ?? "lose";
  const settled: Parlay = {
    ...p,
    status: "settled",
    outcome,
    returned: event.params.amount,
    settledAt: event.block.timestamp,
    settleTx: event.transaction.hash,
  };
  context.Parlay.set(settled);
  await finish(context, event.chainId, settled, event.params.amount, outcome, event.block.timestamp);
});
