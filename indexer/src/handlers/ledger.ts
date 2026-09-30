/** SenryoCore AccountLedger: deposits, withdrawals, collateral swaps and the per-mutation risk snapshot. */
import { type CollateralBalance, type CollateralMove, indexer } from "envio";
import { type CollateralSlot, DEPOSIT_SOURCES } from "../lib/constants.ts";
import { coreTokens, readAccountBalances } from "../lib/effects.ts";
import { type Ctx, EVENT_FIELDS, enumAt, type Meta, metaOf } from "../lib/meta.ts";
import { updateProtocol, updateProtocolDaily, updateUserDaily } from "../lib/stats.ts";
import { addActivity, loadUser, updateUser } from "../lib/users.ts";

type Tokens = { ausd: string; usdc: string };

function slotOf(tokens: Tokens, token: string): CollateralSlot | undefined {
  if (token === tokens.ausd) return "AUSD";
  if (token === tokens.usdc) return "USDC";
  return undefined;
}

async function updateBalance(
  ctx: Ctx,
  userId: string,
  slot: CollateralSlot,
  token: string,
  patch: (b: CollateralBalance) => Partial<CollateralBalance>,
): Promise<void> {
  const id = `${userId}-${slot}`;
  const row: CollateralBalance = (await ctx.CollateralBalance.get(id)) ?? {
    id,
    user_id: userId,
    symbol: slot,
    token,
    balance: undefined,
    balanceBlock: undefined,
    deposited: 0n,
    withdrawn: 0n,
    swappedIn: 0n,
    swappedOut: 0n,
  };
  ctx.CollateralBalance.set({ ...row, ...patch(row) });
}

function move(meta: Meta, fields: Omit<CollateralMove, "id" | "timestamp" | "block" | "txHash">, suffix = "") {
  return {
    id: suffix ? `${meta.id}-${suffix}` : meta.id,
    timestamp: meta.timestamp,
    block: meta.block,
    txHash: meta.txHash,
    ...fields,
  };
}

indexer.onEvent({ contract: "SenryoCore", event: "Deposited", fields: EVENT_FIELDS }, async ({ event, context }) => {
  const meta = metaOf(event);
  const { user, payer, token, amount, source } = event.params;
  const tokens = await context.effect(coreTokens, event.srcAddress);
  const slot = slotOf(tokens, token);
  const before = await loadUser(context, user, meta);
  const firstDeposit = before.firstDepositAt === undefined;
  await updateUser(context, meta, user, (u) => ({
    deposited: u.deposited + amount,
    firstDepositAt: u.firstDepositAt ?? meta.timestamp,
  }));
  if (slot) await updateBalance(context, user, slot, token, (b) => ({ deposited: b.deposited + amount }));
  const source_ = enumAt(DEPOSIT_SOURCES, source, "DepositSource");
  context.CollateralMove.set(
    move(meta, {
      user_id: user,
      kind: "DEPOSIT",
      token,
      symbol: slot,
      amount,
      counterparty: payer,
      source: source_,
    }),
  );
  addActivity(context, meta, user, "DEPOSIT", { amount, symbol: slot, move_id: meta.id });
  await updateUserDaily(context, meta, user, (d) => ({ deposits: d.deposits + amount }));
  await updateProtocol(context, meta, (s) => ({
    deposits: s.deposits + amount,
    depositors: s.depositors + (firstDeposit ? 1 : 0),
  }));
  await updateProtocolDaily(context, meta, (d) => ({ deposits: d.deposits + amount }));
});

indexer.onEvent({ contract: "SenryoCore", event: "Withdrawn", fields: EVENT_FIELDS }, async ({ event, context }) => {
  const meta = metaOf(event);
  const { user, to, token, amount } = event.params;
  const tokens = await context.effect(coreTokens, event.srcAddress);
  const slot = slotOf(tokens, token);
  await updateUser(context, meta, user, (u) => ({ withdrawn: u.withdrawn + amount }));
  if (slot) await updateBalance(context, user, slot, token, (b) => ({ withdrawn: b.withdrawn + amount }));
  context.CollateralMove.set(
    move(meta, {
      user_id: user,
      kind: "WITHDRAW",
      token,
      symbol: slot,
      amount,
      counterparty: to,
      source: undefined,
    }),
  );
  addActivity(context, meta, user, "WITHDRAW", { amount: -amount, symbol: slot, move_id: meta.id });
  await updateUserDaily(context, meta, user, (d) => ({ withdrawals: d.withdrawals + amount }));
  await updateProtocol(context, meta, (s) => ({ withdrawals: s.withdrawals + amount }));
  await updateProtocolDaily(context, meta, (d) => ({ withdrawals: d.withdrawals + amount }));
});

indexer.onEvent(
  { contract: "SenryoCore", event: "CollateralSwapped", fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const { user, tokenIn, tokenOut, amountIn, amountOut } = event.params;
    const tokens = await context.effect(coreTokens, event.srcAddress);
    const slotIn = slotOf(tokens, tokenIn);
    const slotOut = slotOf(tokens, tokenOut);
    await updateUser(context, meta, user, () => ({}));
    if (slotIn) await updateBalance(context, user, slotIn, tokenIn, (b) => ({ swappedOut: b.swappedOut + amountIn }));
    if (slotOut) await updateBalance(context, user, slotOut, tokenOut, (b) => ({ swappedIn: b.swappedIn + amountOut }));
    const common = { user_id: user, counterparty: undefined, source: undefined } as const;
    context.CollateralMove.set(
      move(meta, { ...common, kind: "SWAP_OUT", token: tokenIn, symbol: slotIn, amount: amountIn }, "out"),
    );
    context.CollateralMove.set(
      move(meta, { ...common, kind: "SWAP_IN", token: tokenOut, symbol: slotOut, amount: amountOut }, "in"),
    );
    addActivity(context, meta, user, "SWAP", { amount: amountIn, symbol: slotIn, move_id: `${meta.id}-out` });
  },
);

/**
 * The risk snapshot closes every mutation. It never creates a user on its own: an address whose first event is a
 * snapshot is a liquidator/keeper paid a fee (Liquidated → _emitRisk(msg.sender)), not an app user.
 */
indexer.onEvent(
  { contract: "SenryoCore", event: "AccountRiskUpdated", fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const p = event.params;
    if (!(await context.User.get(p.user))) return;
    const [tokens, balances] = await Promise.all([
      context.effect(coreTokens, event.srcAddress),
      context.effect(readAccountBalances, { core: event.srcAddress, user: p.user, block: meta.block }),
    ]);
    await updateUser(context, meta, p.user, () => ({
      riskNonce: p.nonce,
      equityInit: p.equityInit,
      imTotal: p.imTotal,
      mmTotal: p.mmTotal,
      holds: p.holds,
      cardDebt: p.cardDebt,
      envelope: p.envelope,
      freeToTrade: p.freeToTrade,
      freeToSpend: p.freeToSpend,
      riskUpdatedAt: meta.timestamp,
      riskBlock: meta.block,
    }));
    context.RiskSnapshot.set({
      id: meta.id,
      user_id: p.user,
      nonce: p.nonce,
      equityInit: p.equityInit,
      imTotal: p.imTotal,
      mmTotal: p.mmTotal,
      freeToTrade: p.freeToTrade,
      freeToSpend: p.freeToSpend,
      holds: p.holds,
      cardDebt: p.cardDebt,
      timestamp: meta.timestamp,
      block: meta.block,
    });
    await updateUserDaily(context, meta, p.user, () => ({ equity: p.equityInit }));
    if (balances) {
      const at = { balanceBlock: meta.block };
      await updateBalance(context, p.user, "AUSD", tokens.ausd, () => ({ ...at, balance: balances.ausd }));
      await updateBalance(context, p.user, "USDC", tokens.usdc, () => ({ ...at, balance: balances.usdc }));
    }
  },
);
