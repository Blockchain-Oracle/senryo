/** LpVault (ERC-4626 on AUSD, delayed redeem): LP share balances, redeem requests, pool daily flows. */
import { indexer, type LpPosition } from "envio";
import { DEAD_ADDRESS, ZERO_ADDRESS } from "../lib/constants.ts";
import { type Ctx, EVENT_FIELDS, type Meta, metaOf, small } from "../lib/meta.ts";
import { updateLpDaily, updateProtocol, updateProtocolDaily } from "../lib/stats.ts";
import { addActivity, updateUser } from "../lib/users.ts";

async function updateLp(ctx: Ctx, meta: Meta, owner: string, patch: (p: LpPosition) => Partial<LpPosition>) {
  const row: LpPosition = (await ctx.LpPosition.get(owner)) ?? {
    id: owner,
    owner,
    shares: 0n,
    pendingShares: 0n,
    depositedAssets: 0n,
    redeemedAssets: 0n,
    firstAt: meta.timestamp,
    updatedAt: meta.timestamp,
  };
  ctx.LpPosition.set({ ...row, ...patch(row), updatedAt: meta.timestamp });
}

indexer.onEvent({ contract: "LpVault", event: "Deposit", fields: EVENT_FIELDS }, async ({ event, context }) => {
  const meta = metaOf(event);
  const { owner, assets } = event.params;
  await updateLp(context, meta, owner, (p) => ({ depositedAssets: p.depositedAssets + assets }));
  if (owner !== DEAD_ADDRESS) {
    await updateUser(context, meta, owner, () => ({}));
    addActivity(context, meta, owner, "LP_DEPOSIT", { amount: assets, symbol: "AUSD" });
  }
  await updateLpDaily(context, meta, (d) => ({ deposits: d.deposits + assets }));
  await updateProtocol(context, meta, (s) => ({ lpDeposited: s.lpDeposited + assets }));
  await updateProtocolDaily(context, meta, (d) => ({ lpDeposits: d.lpDeposits + assets }));
});

/** Share movements; the vault's own escrow (requestRedeem) is tracked as pendingShares instead. */
indexer.onEvent({ contract: "LpVault", event: "Transfer", fields: EVENT_FIELDS }, async ({ event, context }) => {
  const meta = metaOf(event);
  const { from, to, value } = event.params;
  const vault = event.srcAddress;
  if (from !== ZERO_ADDRESS && from !== vault)
    await updateLp(context, meta, from, (p) => ({ shares: p.shares - value }));
  if (to !== ZERO_ADDRESS && to !== vault) await updateLp(context, meta, to, (p) => ({ shares: p.shares + value }));
  if (from === ZERO_ADDRESS) {
    await updateLpDaily(context, meta, (d) => ({ sharesMinted: d.sharesMinted + value }));
    await updateProtocol(context, meta, (s) => ({ lpShares: s.lpShares + value }));
  }
  if (to === ZERO_ADDRESS) {
    await updateLpDaily(context, meta, (d) => ({ sharesBurned: d.sharesBurned + value }));
    await updateProtocol(context, meta, (s) => ({ lpShares: s.lpShares - value }));
  }
});

indexer.onEvent({ contract: "LpVault", event: "RedeemRequested", fields: EVENT_FIELDS }, async ({ event, context }) => {
  const meta = metaOf(event);
  const { owner, receiver, requestId, shares, claimableAt } = event.params;
  await updateLp(context, meta, owner, (p) => ({ pendingShares: p.pendingShares + shares }));
  context.LpRedeemRequest.set({
    id: requestId.toString(),
    owner,
    receiver,
    shares,
    claimableAt: small(claimableAt),
    assets: undefined,
    requestedAt: meta.timestamp,
    redeemedAt: undefined,
  });
  await updateUser(context, meta, owner, () => ({}));
  addActivity(context, meta, owner, "LP_REDEEM_REQUESTED");
});

indexer.onEvent({ contract: "LpVault", event: "Redeemed", fields: EVENT_FIELDS }, async ({ event, context }) => {
  const meta = metaOf(event);
  const { owner, requestId, shares, assets } = event.params;
  await updateLp(context, meta, owner, (p) => ({
    pendingShares: p.pendingShares - shares,
    redeemedAssets: p.redeemedAssets + assets,
  }));
  const request = await context.LpRedeemRequest.get(requestId.toString());
  if (request) context.LpRedeemRequest.set({ ...request, assets, redeemedAt: meta.timestamp });
  await updateUser(context, meta, owner, () => ({}));
  addActivity(context, meta, owner, "LP_REDEEMED", { amount: assets, symbol: "AUSD" });
  await updateLpDaily(context, meta, (d) => ({ redeems: d.redeems + assets }));
  await updateProtocol(context, meta, (s) => ({ lpRedeemed: s.lpRedeemed + assets }));
  await updateProtocolDaily(context, meta, (d) => ({ lpRedeems: d.lpRedeems + assets }));
});
