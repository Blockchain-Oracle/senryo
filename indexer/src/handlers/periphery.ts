/** StarterDrip (starter claims, vouchers), IntentRouter (depositAndOpen outcomes), deposit inboxes. */
import { indexer } from "envio";
import { coreTokens } from "../lib/effects.ts";
import { ourMarketId } from "../lib/markets.ts";
import { EVENT_FIELDS, metaOf, small } from "../lib/meta.ts";
import { updateProtocol } from "../lib/stats.ts";
import { addActivity, updateUser } from "../lib/users.ts";

// ---------------------------------------------------------------- StarterDrip

indexer.onEvent(
  { contract: "StarterDrip", event: "StarterClaimed", fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const { user, nativeAmount, practiceAmount } = event.params;
    await updateUser(context, meta, user, () => ({}));
    context.StarterClaim.set({
      id: user,
      user_id: user,
      nativeAmount,
      practiceAmount,
      claimedAt: meta.timestamp,
      txHash: meta.txHash,
    });
    addActivity(context, meta, user, "STARTER", { amount: practiceAmount });
    await updateProtocol(context, meta, (s) => ({ starterClaims: s.starterClaims + 1 }));
  },
);

indexer.onEvent(
  { contract: "StarterDrip", event: "VoucherRedeemed", fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const { user, codeHash, amount } = event.params;
    await updateUser(context, meta, user, (u) => ({ vouchersRedeemed: u.vouchersRedeemed + 1 }));
    context.Voucher.set({ id: codeHash, user_id: user, amount, redeemedAt: meta.timestamp, txHash: meta.txHash });
    addActivity(context, meta, user, "VOUCHER", { amount });
    await updateProtocol(context, meta, (s) => ({ vouchersRedeemed: s.vouchersRedeemed + 1 }));
  },
);

indexer.onEvent(
  { contract: "StarterDrip", event: "VouchersAdded", fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const count = small(event.params.count);
    await updateProtocol(context, metaOf(event), (s) => ({ vouchersAdded: s.vouchersAdded + count }));
  },
);

// ---------------------------------------------------------------- IntentRouter (Aurora depositAndOpen, F21)

indexer.onEvent(
  { contract: "IntentRouter", event: "OrderExecuted", fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const { user, orderHash, marketId, notionalUsd6 } = event.params;
    const market = ourMarketId(small(marketId));
    await updateUser(context, meta, user, () => ({}));
    context.IntentOrder.set({
      id: orderHash,
      user_id: user,
      market_id: market,
      status: "EXECUTED",
      notional: notionalUsd6,
      reason: undefined,
      timestamp: meta.timestamp,
      txHash: meta.txHash,
    });
    addActivity(context, meta, user, "INTENT_EXECUTED", { amount: notionalUsd6, market_id: market });
  },
);

/** The deposit still landed; the order was invalid or stale (IntentRouter never reverts the deposit). */
indexer.onEvent(
  { contract: "IntentRouter", event: "OrderSkipped", fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const { user, orderHash, reason } = event.params;
    await updateUser(context, meta, user, () => ({}));
    context.IntentOrder.set({
      id: orderHash,
      user_id: user,
      market_id: undefined,
      status: "SKIPPED",
      notional: undefined,
      reason,
      timestamp: meta.timestamp,
      txHash: meta.txHash,
    });
    addActivity(context, meta, user, "INTENT_SKIPPED");
  },
);

// ---------------------------------------------------------------- Deposit inboxes ("Monad" family, D-041)

indexer.contractRegister({ contract: "InboxFactory", event: "InboxDeployed" }, async ({ event, context }) => {
  context.chain.DepositInbox.add(event.params.inbox);
});

indexer.onEvent(
  { contract: "InboxFactory", event: "InboxDeployed", fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const { user, inbox } = event.params;
    await updateUser(context, meta, user, () => ({}));
    context.Inbox.set({
      id: inbox,
      user_id: user,
      deployedAt: meta.timestamp,
      pending: 0n,
      received: 0n,
      swept: 0n,
      transferCount: 0,
    });
  },
);

/** The sweep also emits SenryoCore.Deposited(source INBOX), which records the credit; this only settles pending. */
indexer.onEvent({ contract: "DepositInbox", event: "Swept" }, async ({ event, context }) => {
  const { inbox, amount } = event.params;
  const row = await context.Inbox.get(inbox);
  if (!row) return;
  context.Inbox.set({ ...row, swept: row.swept + amount, pending: row.pending > amount ? row.pending - amount : 0n });
});

/** Stablecoins arriving at an inbox before the sweep: the "arrived, crediting" step of the deposit timeline. */
indexer.onEvent({ contract: "Stablecoin", event: "Transfer", fields: EVENT_FIELDS }, async ({ event, context }) => {
  const { from, to, value } = event.params;
  const inbox = await context.Inbox.get(to);
  if (!inbox || value === 0n) return;
  const meta = metaOf(event);
  const core = coreAddress(event.chainId);
  const tokens = core ? await context.effect(coreTokens, core) : undefined;
  const token = event.srcAddress;
  const symbol = tokens?.ausd === token ? "AUSD" : tokens?.usdc === token ? "USDC" : undefined;
  context.Inbox.set({
    ...inbox,
    pending: inbox.pending + value,
    received: inbox.received + value,
    transferCount: inbox.transferCount + 1,
  });
  context.CollateralMove.set({
    id: meta.id,
    user_id: inbox.user_id,
    kind: "INBOX_ARRIVED",
    token,
    symbol,
    amount: value,
    counterparty: from,
    source: "INBOX",
    timestamp: meta.timestamp,
    block: meta.block,
    txHash: meta.txHash,
  });
  addActivity(context, meta, inbox.user_id, "INBOX_ARRIVED", { amount: value, symbol, move_id: meta.id });
});

/** SenryoCore on this chain (static config entry), if it is deployed there. */
function coreAddress(chainId: number): string | undefined {
  const chain: unknown = indexer.chains[chainId as keyof typeof indexer.chains];
  const core = (chain as { SenryoCore?: { addresses: readonly string[] } } | undefined)?.SenryoCore;
  return core?.addresses[0];
}
