import { indexer } from "envio";
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
