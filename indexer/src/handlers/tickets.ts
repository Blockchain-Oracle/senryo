import { type EvmOnEventContext, indexer, type Ticket } from "envio";
import {
  dayOf,
  finishOnAccount,
  key,
  newAccount,
  newDaily,
  newMarket,
  type Outcome,
  realised,
} from "../lib/records.ts";

/**
 * Calls from commit to payout (contracts/src/markets/BandReserve.sol): the ticket, its timeline, the window's crowd
 * split, the market's volume, and the caller's record (counted on fill, realised when the ticket finishes).
 */
const OUTCOMES: Outcome[] = ["lose", "win", "refund"];

type Ctx = EvmOnEventContext;

function timeline(
  context: Ctx,
  chainId: number,
  t: Ticket,
  kind: string,
  amount: bigint,
  timestamp: number,
  txHash: string,
  logIndex: number,
  priceE8?: bigint,
) {
  context.TicketEvent.set({
    id: `${chainId}_${txHash}_${logIndex}`,
    chainId,
    ticketId: t.ticketId,
    owner: t.owner,
    kind,
    amount,
    priceE8,
    timestamp,
    txHash,
  });
}

const EXIT_PRICE = 1;
const EXIT_TRAIL = 2;

/** Which exit sold the shares at `bidE6` (the bid that met take-profit, else the stop), or undefined for the owner. */
function closedByOf(t: Ticket, bidE6: number): string | undefined {
  if (t.exitFiring === EXIT_TRAIL) return "trail";
  if (t.exitFiring !== EXIT_PRICE) return undefined;
  return t.exitTakeProfitE6 > 0 && bidE6 >= t.exitTakeProfitE6 ? "take-profit" : "stop-loss";
}

/** A ticket that finished (fully cashed out or settled) realises its result on the caller's record. */
async function finish(context: Ctx, chainId: number, t: Ticket, outcome: Outcome, at: number) {
  const { pnl } = realised(t);
  const accountId = key(chainId, t.owner);
  const account = (await context.Account.get(accountId)) ?? newAccount(chainId, t.owner);
  context.Account.set(finishOnAccount(account, pnl, outcome, at));
  const day = dayOf(at);
  const daily = (await context.DailyAccountStat.get(`${accountId}_${day}`)) ?? newDaily(chainId, t.owner, day);
  context.DailyAccountStat.set({ ...daily, pnl: daily.pnl + pnl, wins: daily.wins + (outcome === "win" ? 1 : 0) });
}

indexer.onEvent({ contract: "BandReserve", event: "Committed" }, async ({ event, context }) => {
  const p = event.params;
  const t: Ticket = {
    id: key(event.chainId, p.ticketId),
    chainId: event.chainId,
    ticketId: p.ticketId,
    owner: p.owner,
    windowId: p.windowId,
    band: Number(p.band),
    status: "committed",
    originalStake: p.stake,
    stake: p.stake,
    payout: 0n,
    entryE8: undefined,
    probE6: undefined,
    priceE6: undefined,
    target: Number(p.target),
    viaSession: p.viaSession,
    committedAt: event.block.timestamp,
    committedTx: event.transaction.hash,
    committedBy: event.transaction.from ?? "",
    filledAt: undefined,
    fillTx: undefined,
    closedShares: 0n,
    proceeds: 0n,
    refunded: 0n,
    paid: 0n,
    outcome: undefined,
    refuseReason: undefined,
    settledAt: undefined,
    claimTx: undefined,
    exitTakeProfitE6: 0,
    exitStopLossE6: 0,
    exitFloorE6: 0,
    exitTrailE6: 0,
    exitFiring: undefined,
    closedBy: undefined,
  };
  context.Ticket.set(t);
  timeline(
    context,
    event.chainId,
    t,
    "committed",
    p.stake,
    event.block.timestamp,
    event.transaction.hash,
    event.logIndex,
  );
});

indexer.onEvent({ contract: "BandReserve", event: "Filled" }, async ({ event, context }) => {
  const p = event.params;
  const t = await context.Ticket.get(key(event.chainId, p.ticketId));
  if (!t) return;
  const filled: Ticket = {
    ...t,
    status: "open",
    payout: p.payout,
    stake: p.stake,
    entryE8: p.entryE8,
    probE6: Number(p.probE6),
    priceE6: Number(p.priceE6),
    filledAt: event.block.timestamp,
    fillTx: event.transaction.hash,
  };
  context.Ticket.set(filled);
  timeline(
    context,
    event.chainId,
    filled,
    "filled",
    p.payout,
    event.block.timestamp,
    event.transaction.hash,
    event.logIndex,
    p.entryE8,
  );

  const w = await context.Window.get(key(event.chainId, t.windowId));
  if (w) {
    const bandStake = w.bandStake.map((v, i) => (i === t.band ? v + p.stake : v));
    context.Window.set({ ...w, calls: w.calls + 1, volume: w.volume + p.stake, bandStake });
    const m = (await context.Market.get(key(event.chainId, w.seriesId))) ?? newMarket(event.chainId, w.seriesId);
    context.Market.set({ ...m, calls: m.calls + 1, volume: m.volume + p.stake });
  }
  const accountId = key(event.chainId, t.owner);
  const a = (await context.Account.get(accountId)) ?? newAccount(event.chainId, t.owner);
  context.Account.set({
    ...a,
    calls: a.calls + 1,
    staked: a.staked + p.stake,
    lastActiveAt: Math.max(a.lastActiveAt, event.block.timestamp),
  });
  const day = dayOf(event.block.timestamp);
  const d = (await context.DailyAccountStat.get(`${accountId}_${day}`)) ?? newDaily(event.chainId, t.owner, day);
  context.DailyAccountStat.set({ ...d, calls: d.calls + 1, staked: d.staked + p.stake });
});

indexer.onEvent({ contract: "BandReserve", event: "Refused" }, async ({ event, context }) => {
  const t = await context.Ticket.get(key(event.chainId, event.params.ticketId));
  if (!t) return;
  const refused: Ticket = {
    ...t,
    status: "refunded",
    refunded: event.params.refunded,
    refuseReason: Number(event.params.reason),
    outcome: "refund",
  };
  context.Ticket.set(refused);
  timeline(
    context,
    event.chainId,
    refused,
    "refused",
    event.params.refunded,
    event.block.timestamp,
    event.transaction.hash,
    event.logIndex,
  );
});

indexer.onEvent({ contract: "BandReserve", event: "CloseCommitted" }, async ({ event, context }) => {
  const t = await context.Ticket.get(key(event.chainId, event.params.ticketId));
  if (!t) return;
  // An exit's own close is followed by `ExitFired` in the same transaction; the owner's own close clears it.
  context.Ticket.set({ ...t, status: "closing", target: Number(event.params.target), exitFiring: undefined });
  timeline(
    context,
    event.chainId,
    t,
    "close requested",
    event.params.shares,
    event.block.timestamp,
    event.transaction.hash,
    event.logIndex,
  );
});

indexer.onEvent({ contract: "BandReserve", event: "Closed" }, async ({ event, context }) => {
  const p = event.params;
  const t = await context.Ticket.get(key(event.chainId, p.ticketId));
  if (!t) return;
  const payout = t.payout - p.shares;
  const by = closedByOf(t, Number(p.bidE6));
  const closed: Ticket = {
    ...t,
    status: payout === 0n ? "closed" : "open",
    payout,
    stake: t.stake - p.basisOut,
    closedShares: t.closedShares + p.shares,
    proceeds: t.proceeds + p.proceeds,
    exitFiring: undefined,
    closedBy: by,
  };
  context.Ticket.set(closed);
  timeline(
    context,
    event.chainId,
    closed,
    "cashed out",
    p.proceeds,
    event.block.timestamp,
    event.transaction.hash,
    event.logIndex,
    p.exitE8,
  );
  const a = (await context.Account.get(key(event.chainId, t.owner))) ?? newAccount(event.chainId, t.owner);
  context.Account.set({ ...a, returned: a.returned + p.proceeds });
  if (payout === 0n) {
    const outcome: Outcome = closed.proceeds > closed.originalStake ? "win" : "lose";
    context.Ticket.set({ ...closed, outcome });
    await finish(context, event.chainId, closed, outcome, event.block.timestamp);
  }
});

indexer.onEvent({ contract: "BandReserve", event: "CloseRefused" }, async ({ event, context }) => {
  const t = await context.Ticket.get(key(event.chainId, event.params.ticketId));
  if (!t) return;
  context.Ticket.set({ ...t, status: "open", exitFiring: undefined });
  timeline(
    context,
    event.chainId,
    t,
    "close refused",
    0n,
    event.block.timestamp,
    event.transaction.hash,
    event.logIndex,
  );
});

indexer.onEvent({ contract: "BandReserve", event: "Claimed" }, async ({ event, context }) => {
  const p = event.params;
  const t = await context.Ticket.get(key(event.chainId, p.ticketId));
  if (!t) return;
  const outcome = OUTCOMES[Number(p.outcome)] ?? "lose";
  const refund = outcome === "refund";
  const settled: Ticket = {
    ...t,
    status: "settled",
    outcome,
    paid: refund ? t.paid : t.paid + p.amount,
    refunded: refund ? t.refunded + p.amount : t.refunded,
    settledAt: event.block.timestamp,
    claimTx: event.transaction.hash,
  };
  context.Ticket.set(settled);
  timeline(
    context,
    event.chainId,
    settled,
    `settled: ${outcome}`,
    p.amount,
    event.block.timestamp,
    event.transaction.hash,
    event.logIndex,
  );
  const a = (await context.Account.get(key(event.chainId, t.owner))) ?? newAccount(event.chainId, t.owner);
  context.Account.set({ ...a, returned: a.returned + p.amount });
  await finish(context, event.chainId, settled, outcome, event.block.timestamp);
  const w = await context.Window.get(key(event.chainId, t.windowId));
  if (w && p.amount > 0n) {
    const m = (await context.Market.get(key(event.chainId, w.seriesId))) ?? newMarket(event.chainId, w.seriesId);
    context.Market.set({ ...m, paidOut: m.paidOut + p.amount });
  }
});

indexer.onEvent({ contract: "BandReserve", event: "ExitSet" }, async ({ event, context }) => {
  const p = event.params;
  const t = await context.Ticket.get(key(event.chainId, p.ticketId));
  if (!t) return;
  const set: Ticket = {
    ...t,
    exitTakeProfitE6: Number(p.takeProfitE6),
    exitStopLossE6: Number(p.stopLossE6),
    exitFloorE6: Number(p.floorE6),
    exitTrailE6: Number(p.trailE6),
  };
  context.Ticket.set(set);
  const cleared = set.exitTakeProfitE6 === 0 && set.exitStopLossE6 === 0 && set.exitTrailE6 === 0;
  timeline(
    context,
    event.chainId,
    set,
    cleared ? "exit removed" : "exit set",
    0n,
    event.block.timestamp,
    event.transaction.hash,
    event.logIndex,
  );
});

indexer.onEvent({ contract: "BandReserve", event: "ExitFired" }, async ({ event, context }) => {
  const t = await context.Ticket.get(key(event.chainId, event.params.ticketId));
  if (!t) return;
  context.Ticket.set({ ...t, exitFiring: Number(event.params.kind) });
  timeline(
    context,
    event.chainId,
    t,
    Number(event.params.kind) === EXIT_TRAIL ? "trail fired" : "exit fired",
    0n,
    event.block.timestamp,
    event.transaction.hash,
    event.logIndex,
  );
});
