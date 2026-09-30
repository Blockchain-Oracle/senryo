/** SenryoCore CardModule: spend allowance, envelope, holds (place → increase → capture/release), refunds, card debt. */
import { type CardHold, indexer } from "envio";
import { updateCardDebt } from "../lib/card.ts";
import { RELEASE_REASONS } from "../lib/constants.ts";
import { type Ctx, EVENT_FIELDS, enumAt, metaOf, small } from "../lib/meta.ts";
import { updateProtocol, updateProtocolDaily, updateUserDaily } from "../lib/stats.ts";
import { addActivity, updateUser } from "../lib/users.ts";

async function loadHold(ctx: Ctx, holdId: string): Promise<CardHold> {
  return ctx.CardHold.getOrThrow(holdId, `CardHold ${holdId} missing (event before HoldPlaced)`);
}

indexer.onEvent({ contract: "SenryoCore", event: "AllowanceSet", fields: EVENT_FIELDS }, async ({ event, context }) => {
  const meta = metaOf(event);
  const { user, dailyLimit, expiry, nonce } = event.params;
  await updateUser(context, meta, user, () => ({}));
  context.Allowance.set({ id: user, user_id: user, dailyLimit, expiry: small(expiry), nonce, setAt: meta.timestamp });
  addActivity(context, meta, user, "CARD_ALLOWANCE", { amount: dailyLimit });
});

indexer.onEvent(
  { contract: "SenryoCore", event: "CardEnvelopeSet", fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const { user, envelope } = event.params;
    await updateUser(context, meta, user, () => ({ envelope }));
    addActivity(context, meta, user, "CARD_ENVELOPE", { amount: envelope });
  },
);

indexer.onEvent({ contract: "SenryoCore", event: "HoldPlaced", fields: EVENT_FIELDS }, async ({ event, context }) => {
  const meta = metaOf(event);
  const { holdId, user, amount, expiry, fromEnvelope } = event.params;
  await updateUser(context, meta, user, () => ({}));
  context.CardHold.set({
    id: holdId,
    user_id: user,
    amount,
    placedAmount: amount,
    captured: 0n,
    released: 0n,
    debtCreated: 0n,
    expiry: small(expiry),
    fromEnvelope,
    status: "OPEN",
    releaseReason: undefined,
    placedAt: meta.timestamp,
    settledAt: undefined,
    txHash: meta.txHash,
  });
  addActivity(context, meta, user, "CARD_HOLD", { amount: -amount, hold_id: holdId });
  await updateProtocol(context, meta, (s) => ({
    cardHoldsPlaced: s.cardHoldsPlaced + 1,
    cardHeld: s.cardHeld + amount,
  }));
  await updateProtocolDaily(context, meta, (d) => ({ cardHolds: d.cardHolds + 1 }));
});

indexer.onEvent(
  { contract: "SenryoCore", event: "HoldIncreased", fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const { holdId, user, delta, amount } = event.params;
    const hold = await loadHold(context, holdId);
    context.CardHold.set({ ...hold, amount });
    addActivity(context, meta, user, "CARD_HOLD_INCREASED", { amount: -delta, hold_id: holdId });
    await updateProtocol(context, meta, (s) => ({ cardHeld: s.cardHeld + delta }));
  },
);

indexer.onEvent({ contract: "SenryoCore", event: "HoldCaptured", fields: EVENT_FIELDS }, async ({ event, context }) => {
  const meta = metaOf(event);
  const { holdId, user, captured, released, debtCreated } = event.params;
  const hold = await loadHold(context, holdId);
  context.CardHold.set({ ...hold, captured, released, debtCreated, status: "CAPTURED", settledAt: meta.timestamp });
  await updateUser(context, meta, user, (u) => ({ cardSpent: u.cardSpent + captured }));
  if (debtCreated > 0n) {
    await updateCardDebt(context, meta, user, (d) => ({
      created: d.created + debtCreated,
      outstanding: d.outstanding + debtCreated,
    }));
  }
  addActivity(context, meta, user, "CARD_CAPTURE", { amount: -captured, hold_id: holdId });
  await updateUserDaily(context, meta, user, (d) => ({ cardSpend: d.cardSpend + captured }));
  await updateProtocol(context, meta, (s) => ({
    cardSpent: s.cardSpent + captured,
    cardHeld: s.cardHeld - hold.amount,
  }));
  await updateProtocolDaily(context, meta, (d) => ({ cardSpend: d.cardSpend + captured }));
});

indexer.onEvent({ contract: "SenryoCore", event: "HoldReleased", fields: EVENT_FIELDS }, async ({ event, context }) => {
  const meta = metaOf(event);
  const { holdId, user, amount, reason } = event.params;
  const hold = await loadHold(context, holdId);
  context.CardHold.set({
    ...hold,
    released: amount,
    status: "RELEASED",
    releaseReason: enumAt(RELEASE_REASONS, reason, "ReleaseReason"),
    settledAt: meta.timestamp,
  });
  addActivity(context, meta, user, "CARD_RELEASE", { amount, hold_id: holdId });
  await updateProtocol(context, meta, (s) => ({ cardHeld: s.cardHeld - amount }));
});

indexer.onEvent({ contract: "SenryoCore", event: "CardRefunded", fields: EVENT_FIELDS }, async ({ event, context }) => {
  const meta = metaOf(event);
  const { user, refId, amount, debtRepaid } = event.params;
  await updateUser(context, meta, user, (u) => ({ cardRefunded: u.cardRefunded + amount }));
  context.CardRefund.set({
    id: refId,
    user_id: user,
    amount,
    debtRepaid,
    timestamp: meta.timestamp,
    txHash: meta.txHash,
  });
  if (debtRepaid > 0n) {
    await updateCardDebt(context, meta, user, (d) => ({
      repaid: d.repaid + debtRepaid,
      outstanding: d.outstanding - debtRepaid,
    }));
  }
  addActivity(context, meta, user, "CARD_REFUND", { amount });
  await updateProtocol(context, meta, (s) => ({ cardRefunded: s.cardRefunded + amount }));
});

indexer.onEvent(
  { contract: "SenryoCore", event: "CardDebtRepaid", fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const { user, amount, debtAfter } = event.params;
    await updateUser(context, meta, user, () => ({}));
    await updateCardDebt(context, meta, user, (d) => ({ repaid: d.repaid + amount, outstanding: debtAfter }));
    addActivity(context, meta, user, "CARD_DEBT_REPAID", { amount: -amount });
  },
);
