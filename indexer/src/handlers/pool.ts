import { type EvmOnEventContext, indexer } from "envio";
import { key, newPool } from "../lib/records.ts";

/** The pool, window settlement and sessions (contracts/src/markets/{BandPool,BandReserve,SessionGrants}.sol). */

indexer.onEvent({ contract: "BandReserve", event: "WindowSettled" }, async ({ event, context }) => {
  const p = event.params;
  const w = await context.Window.get(key(event.chainId, p.windowId));
  if (w) {
    context.Window.set({
      ...w,
      settled: true,
      wonMask: Number(p.wonMask),
      refundMask: Number(p.refundMask),
      lostMask: Number(p.lostMask),
      toPool: p.toPool,
      toHolders: p.toHolders,
      settledTx: event.transaction.hash,
    });
  }
  const pool = (await context.Pool.get(String(event.chainId))) ?? newPool(event.chainId);
  context.Pool.set({
    ...pool,
    settledToPool: pool.settledToPool + p.toPool,
    settledToHolders: pool.settledToHolders + p.toHolders,
  });
});

indexer.onEvent({ contract: "BandReserve", event: "PoolFunded" }, async ({ event, context }) => {
  const pool = (await context.Pool.get(String(event.chainId))) ?? newPool(event.chainId);
  context.Pool.set({ ...pool, funded: pool.funded + event.params.amount });
});

indexer.onEvent({ contract: "BandReserve", event: "PoolDefunded" }, async ({ event, context }) => {
  const pool = (await context.Pool.get(String(event.chainId))) ?? newPool(event.chainId);
  context.Pool.set({ ...pool, defunded: pool.defunded + event.params.amount });
});

indexer.onEvent({ contract: "BandReserve", event: "SessionGranted" }, async ({ event, context }) => {
  const p = event.params;
  context.Session.set({
    id: key(event.chainId, p.owner),
    chainId: event.chainId,
    owner: p.owner,
    delegate: p.delegate,
    perCallCap: p.perCallCap,
    sessionCap: p.sessionCap,
    expiry: Number(p.expiry),
    epoch: Number(p.epoch),
    grantedTx: event.transaction.hash,
  });
});

indexer.onEvent({ contract: "BandReserve", event: "EpochBumped" }, async ({ event, context }) => {
  // A revoke ends the session (the contract deletes it); the epoch is the owner's, kept on the record.
  const s = await context.Session.get(key(event.chainId, event.params.owner));
  if (s) context.Session.set({ ...s, expiry: 0, epoch: Number(event.params.epoch) });
});

/** One account's money in and out of Earn (P5), the base its net earned is read against. */
async function earnFlow(
  context: EvmOnEventContext,
  chainId: number,
  account: string,
  at: number,
  delta: { paidIn?: bigint; paidOut?: bigint },
) {
  const id = key(chainId, account.toLowerCase());
  const was = await context.EarnAccount.get(id);
  context.EarnAccount.set({
    id,
    chainId,
    account: account.toLowerCase(),
    paidIn: (was?.paidIn ?? 0n) + (delta.paidIn ?? 0n),
    paidOut: (was?.paidOut ?? 0n) + (delta.paidOut ?? 0n),
    updatedAt: at,
  });
}

indexer.onEvent({ contract: "PoolShares", event: "SupplyRequested" }, async ({ event, context }) => {
  await earnFlow(context, event.chainId, event.params.account, event.block.timestamp, { paidIn: event.params.assets });
});

indexer.onEvent({ contract: "PoolShares", event: "RequestCancelled" }, async ({ event, context }) => {
  // A supply taken back returns its dollars; a withdrawal taken back returns shares, not dollars.
  if (!event.params.supply) return;
  await earnFlow(context, event.chainId, event.params.account, event.block.timestamp, { paidIn: -event.params.amount });
});

indexer.onEvent({ contract: "PoolShares", event: "Claimed" }, async ({ event, context }) => {
  if (event.params.assets === 0n) return;
  await earnFlow(context, event.chainId, event.params.account, event.block.timestamp, { paidOut: event.params.assets });
});

/** Earn's hourly roll (contracts/src/markets/PoolShares.sol, D-287): each hour's value, supply and flows. */
indexer.onEvent({ contract: "PoolShares", event: "EpochRolled" }, async ({ event, context }) => {
  const p = event.params;
  context.PoolEpoch.set({
    id: key(event.chainId, String(p.hour)),
    chainId: event.chainId,
    hour: Number(p.hour),
    value: p.value,
    supply: p.supply,
    supplied: p.suppliedAssets,
    withdrawn: p.withdrawnAssets,
    deferred: p.deferred,
    ridesOwed: p.ridesOwed,
    rolledTx: event.transaction.hash,
  });
});
