import { type EventMarket, type EvmOnEventContext, indexer } from "envio";
import { countCall, finishCall, key, type Outcome } from "../lib/records.ts";

/**
 * Yes/no events (contracts/src/events/EventBook.sol, D-296): the committee as set, each question from listing to its
 * verdict, every member's answer, and every call — a call counts on its caller's record once placed and realises its
 * result when it is paid, like any call.
 */
type Ctx = EvmOnEventContext;

const VOID_REASONS = ["none", "disagreement", "quorum", "no-winners"];
const OUTCOMES: Outcome[] = ["lose", "win", "refund"];
const CALL_STATUS: Record<Outcome, string> = { lose: "lost", win: "won", refund: "refunded" };

async function marketOf(context: Ctx, chainId: number, eventId: string): Promise<EventMarket | undefined> {
  return context.EventMarket.get(key(chainId, eventId));
}

indexer.onEvent({ contract: "EventBook", event: "CommitteeSet" }, async ({ event, context }) => {
  const p = event.params;
  context.EventCommittee.set({
    id: key(event.chainId, String(p.committeeId)),
    chainId: event.chainId,
    committeeId: Number(p.committeeId),
    members: p.members.map((m) => m.toLowerCase()),
    names: [...p.names],
    quorum: Number(p.quorum),
    enabled: true,
  });
});

indexer.onEvent({ contract: "EventBook", event: "CommitteeEnabled" }, async ({ event, context }) => {
  const c = await context.EventCommittee.get(key(event.chainId, String(event.params.committeeId)));
  if (c) context.EventCommittee.set({ ...c, enabled: event.params.enabled });
});

indexer.onEvent({ contract: "EventBook", event: "EventListed" }, async ({ event, context }) => {
  const p = event.params;
  context.EventMarket.set({
    id: key(event.chainId, p.eventId),
    chainId: event.chainId,
    eventId: p.eventId,
    committeeId: Number(p.committeeId),
    question: p.question,
    rules: p.rules,
    termsHash: p.termsHash,
    feeBps: Number(p.feeBps),
    closesAt: Number(p.closesAt),
    answerFrom: Number(p.answerFrom),
    answerBy: Number(p.answerBy),
    state: "open",
    answer: undefined,
    voidReason: undefined,
    yesPool: 0n,
    noPool: 0n,
    calls: 0,
    fee: undefined,
    prize: undefined,
    listedAt: event.block.timestamp,
    listedTx: event.transaction.hash,
    decidedAt: undefined,
    decidedTx: undefined,
  });
});

indexer.onEvent({ contract: "EventBook", event: "Called" }, async ({ event, context }) => {
  const p = event.params;
  const m = await marketOf(context, event.chainId, p.eventId);
  if (m) context.EventMarket.set({ ...m, yesPool: p.yesPool, noPool: p.noPool, calls: m.calls + 1 });
  context.EventCall.set({
    id: key(event.chainId, p.ticketId),
    chainId: event.chainId,
    ticketId: p.ticketId,
    eventId: p.eventId,
    owner: p.owner,
    yes: p.yes,
    stake: p.stake,
    status: "open",
    amount: undefined,
    calledAt: event.block.timestamp,
    callTx: event.transaction.hash,
    paidAt: undefined,
    paidTx: undefined,
  });
  await countCall(context, event.chainId, p.owner, p.stake, event.block.timestamp);
});

indexer.onEvent({ contract: "EventBook", event: "Answered" }, async ({ event, context }) => {
  const p = event.params;
  context.EventAnswer.set({
    id: `${key(event.chainId, p.eventId)}_${p.member.toLowerCase()}`,
    chainId: event.chainId,
    eventId: p.eventId,
    member: p.member,
    yes: p.yes,
    statementHash: p.statementHash,
    attestedAt: Number(p.attestedAt),
    answeredTx: event.transaction.hash,
  });
});

indexer.onEvent({ contract: "EventBook", event: "EventDecided" }, async ({ event, context }) => {
  const m = await marketOf(context, event.chainId, event.params.eventId);
  if (!m) return;
  context.EventMarket.set({
    ...m,
    state: "decided",
    answer: event.params.yes,
    fee: event.params.fee,
    prize: event.params.prize,
    decidedAt: event.block.timestamp,
    decidedTx: event.transaction.hash,
  });
});

indexer.onEvent({ contract: "EventBook", event: "EventVoided" }, async ({ event, context }) => {
  const m = await marketOf(context, event.chainId, event.params.eventId);
  if (!m) return;
  const reason = VOID_REASONS[Number(event.params.reason)] ?? "none";
  context.EventMarket.set({
    ...m,
    state: "voided",
    voidReason: reason,
    answer: reason === "no-winners" ? event.params.answer : undefined,
    decidedAt: event.block.timestamp,
    decidedTx: event.transaction.hash,
  });
});

indexer.onEvent({ contract: "EventBook", event: "CallPaid" }, async ({ event, context }) => {
  const c = await context.EventCall.get(key(event.chainId, event.params.ticketId));
  if (!c) return;
  const outcome = OUTCOMES[Number(event.params.outcome)] ?? "lose";
  context.EventCall.set({
    ...c,
    status: CALL_STATUS[outcome],
    amount: event.params.amount,
    paidAt: event.block.timestamp,
    paidTx: event.transaction.hash,
  });
  await finishCall(context, event.chainId, c, event.params.amount, outcome, event.block.timestamp);
});
