import { indexer } from "envio";
import { BAND_SLOTS, key, newMarket } from "../lib/records.ts";

/** Series, windows, prints and verdicts (contracts/src/markets/Windows.sol). */
const STATES = ["open", "resolved", "voided"] as const;

indexer.onEvent({ contract: "Windows", event: "SeriesRegistered" }, async ({ event, context }) => {
  const id = key(event.chainId, event.params.seriesId);
  const m = (await context.Market.get(id)) ?? newMarket(event.chainId, event.params.seriesId);
  context.Market.set({ ...m, marketKey: event.params.market, cadenceSec: Number(event.params.cadenceSec) });
});

indexer.onEvent({ contract: "Windows", event: "WindowOpened" }, async ({ event, context }) => {
  context.Window.set({
    id: key(event.chainId, event.params.windowId),
    chainId: event.chainId,
    windowId: event.params.windowId,
    seriesId: event.params.seriesId,
    start: Number(event.params.start),
    expiry: Number(event.params.expiry),
    state: "open",
    voidReason: 0,
    openE8: undefined,
    closeE8: undefined,
    calls: 0,
    volume: 0n,
    bandStake: Array.from({ length: BAND_SLOTS }, () => 0n),
    settled: false,
    wonMask: 0,
    refundMask: 0,
    lostMask: 0,
    toPool: 0n,
    toHolders: 0n,
    openedTx: event.transaction.hash,
    resolvedTx: undefined,
    settledTx: undefined,
  });
});

indexer.onEvent({ contract: "Windows", event: "PrintRecorded" }, async ({ event, context }) => {
  context.Print.set({
    id: key(event.chainId, event.params.printKey),
    chainId: event.chainId,
    feedId: event.params.feedId,
    t: Number(event.params.t),
    priceE8: event.params.priceE8,
    confE8: event.params.confE8,
    publishTime: Number(event.params.publishTime),
    txHash: event.transaction.hash,
  });
});

indexer.onEvent({ contract: "Windows", event: "WindowResolved" }, async ({ event, context }) => {
  const w = await context.Window.get(key(event.chainId, event.params.windowId));
  if (!w) return;
  context.Window.set({
    ...w,
    state: STATES[Number(event.params.state)] ?? "open",
    voidReason: Number(event.params.voidReason),
    openE8: event.params.openE8 === 0n ? w.openE8 : event.params.openE8,
    closeE8: event.params.closeE8 === 0n ? w.closeE8 : event.params.closeE8,
    resolvedTx: event.transaction.hash,
  });
});
