/**
 * Perpl accounts, collateral, market metadata and funding. AccountCreated and ContractAdded(V2) run from Perpl's
 * deploy block (owner ↔ accountId links and market decimals must predate the app); balances and funding from
 * APP_LAUNCH_BLOCK.
 */
import { indexer } from "envio";
import { newPerplMarket, perplMarketId } from "../lib/markets.ts";
import { type Ctx, EVENT_FIELDS, type Meta, metaOf, small } from "../lib/meta.ts";
import { afterLaunch } from "../lib/perpl.ts";
import { addActivity, updateUser } from "../lib/users.ts";

indexer.onEvent(
  { contract: "PerplExchange", event: "AccountCreated", fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const { account, id } = event.params;
    const accountKey = id.toString();
    const user = await context.User.get(account);
    context.PerplAccount.set({
      id: accountKey,
      owner: account,
      user_id: user ? account : undefined,
      balance: undefined,
      createdAt: meta.timestamp,
      deposited: 0n,
      withdrawn: 0n,
    });
    if (user) context.User.set({ ...user, perplAccount_id: accountKey });
  },
);

async function upsertPerplMarket(
  ctx: Ctx,
  p: { perpId: bigint; name: string; symbol: string; priceDecimals: bigint; lotDecimals: bigint },
) {
  const id = perplMarketId(p.perpId);
  const existing = await ctx.Market.get(id);
  const seed = {
    id,
    marketIndex: p.perpId,
    symbol: p.symbol,
    name: p.name,
    priceDecimals: small(p.priceDecimals),
    lotDecimals: small(p.lotDecimals),
  };
  ctx.Market.set(existing ? { ...existing, ...seed } : newPerplMarket(seed));
}

indexer.onEvent({ contract: "PerplExchange", event: "ContractAdded" }, async ({ event, context }) => {
  await upsertPerplMarket(context, event.params);
});

indexer.onEvent({ contract: "PerplExchange", event: "ContractAddedV2" }, async ({ event, context }) => {
  await upsertPerplMarket(context, event.params);
});

async function collateral(ctx: Ctx, meta: Meta, accountId: bigint, amount: bigint, balance: bigint, deposit: boolean) {
  const account = await ctx.PerplAccount.get(accountId.toString());
  if (!account) return;
  ctx.PerplAccount.set({
    ...account,
    balance,
    deposited: account.deposited + (deposit ? amount : 0n),
    withdrawn: account.withdrawn + (deposit ? 0n : amount),
  });
  const userId = account.user_id;
  if (!userId) return;
  await updateUser(ctx, meta, userId, () => ({ perplCollateral: balance }));
  ctx.CollateralMove.set({
    id: meta.id,
    user_id: userId,
    kind: deposit ? "PERPL_DEPOSIT" : "PERPL_WITHDRAW",
    token: undefined,
    symbol: "AUSD",
    amount,
    counterparty: undefined,
    source: undefined,
    timestamp: meta.timestamp,
    block: meta.block,
    txHash: meta.txHash,
  });
  addActivity(ctx, meta, userId, deposit ? "PERPL_DEPOSIT" : "PERPL_WITHDRAW", {
    amount: deposit ? amount : -amount,
    symbol: "AUSD",
    move_id: meta.id,
  });
}

indexer.onEvent(
  { contract: "PerplExchange", event: "CollateralDeposit", where: afterLaunch, fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const { accountId, amountCNS, balanceCNS } = event.params;
    await collateral(context, metaOf(event), accountId, amountCNS, balanceCNS, true);
  },
);

indexer.onEvent(
  { contract: "PerplExchange", event: "CollateralWithdrawal", where: afterLaunch, fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const { accountId, amountCNS, balanceCNS } = event.params;
    await collateral(context, metaOf(event), accountId, amountCNS, balanceCNS, false);
  },
);

/** Market-level funding (all Perpl markets): rate in pct·1e5, the funding sum as the index. */
indexer.onEvent(
  { contract: "PerplExchange", event: "FundingEventCompleted", where: afterLaunch, fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const p = event.params;
    const marketId = perplMarketId(p.perpId);
    const market = await context.Market.get(marketId);
    if (!market) return;
    context.Market.set({ ...market, fundingRate: p.actualRatePct100k, fundingIndex: p.fundingSumPNS });
    context.FundingRate.set({
      id: `${marketId}-${p.fundingEventBlock}`,
      market_id: marketId,
      fundingRate: p.actualRatePct100k,
      borrowRate: 0n,
      fundingIndex: p.fundingSumPNS,
      timestamp: meta.timestamp,
      block: meta.block,
    });
  },
);
