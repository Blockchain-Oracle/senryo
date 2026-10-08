/** biome-ignore-all lint/style/noMagicNumbers: Exact localhost-only lifecycle fixture. */
import assert from "node:assert/strict";
import {
  addressOf,
  CONTRACT_ABIS,
  contractCall,
  createReadClient,
  createSender,
  MemoryJournal,
  readAccountSnapshot,
  readMarketRisk,
  readPositions,
  receiptEvents,
  type TxRequest,
} from "@senryo/chain";
import { TESTNET_CHAIN_ID as CHAIN } from "@senryo/config";
import { previewDecrease, previewIncrease } from "@senryo/core";
import {
  cancelTriggerRequest,
  closeRequest,
  decreaseRequest,
  increaseRequest,
  placeTriggerRequest,
  riskViewOf,
  sendTracked,
  triggerOrder,
} from "@senryo/query";
import { anvil, freshUser, prepareFork } from "./fork.ts";

const RPC = "http://127.0.0.1:18873";
assert.equal(new URL(RPC).hostname, "127.0.0.1");
assert.match(await anvil<string>(RPC, "web3_clientVersion", []), /anvil/i);
const read = createReadClient(CHAIN, { http: [RPC] });
assert.equal(await read.getChainId(), CHAIN);
const user = freshUser();
const keeper = freshUser();
await prepareFork(RPC, [], [user.address, keeper.address], [[70n, keeper.address]]);
const sender = createSender({
  chainId: CHAIN,
  account: user,
  read,
  rpc: { http: [RPC] },
  journal: new MemoryJournal(),
});
const oracle = createSender({
  chainId: CHAIN,
  account: keeper,
  read,
  rpc: { http: [RPC] },
  journal: new MemoryJournal(),
});
async function run(request: TxRequest, label: string, from = sender) {
  const result = await sendTracked(from, request, () => undefined);
  assert.equal(result.final?.stage, "finalized", label);
  console.log(`${label}: finalized ${result.hash}`);
  return result;
}
const mark = (await readMarketRisk(read, CHAIN, 0)).pv.latest18;
await run(
  contractCall(CHAIN, "MirrorXAU", "pushAnswer", [mark / 10n ** 10n], "pushAnswer"),
  "fresh disposable oracle",
  oracle,
);
await run(contractCall(CHAIN, "SessionOracle", "observe", [0], "observe"), "observe disposable oracle", oracle);
await run(contractCall(CHAIN, "MockAUSD", "faucet", [], "faucet"), "faucet");
await run(
  contractCall(CHAIN, "MockAUSD", "approve", [addressOf(CHAIN, "SenryoCore"), 20_000_000n], "approve"),
  "approve",
);
await run(
  contractCall(CHAIN, "SenryoCore", "deposit", [addressOf(CHAIN, "MockAUSD"), 20_000_000n], "deposit"),
  "deposit",
);
const market = await readMarketRisk(read, CHAIN, 0);
const account = await readAccountSnapshot(read, CHAIN, user.address);
const preview = previewIncrease({
  market: market.risk,
  book: market.book,
  pv: market.pv,
  account: riskViewOf(account),
  isLong: true,
  notionalUsd6: 10_000_000n,
});
await run(increaseRequest(CHAIN, 0, true, 10_000_000n, preview.execPrice18, 1), "open");
const held = async () =>
  (
    await readPositions(
      read,
      CHAIN,
      user.address,
      (
        await readAccountSnapshot(read, CHAIN, user.address)
      ).positionBitmap,
    )
  )[0];
const position = await held();
assert.ok(position && position.size > 0n);
const active = (id: `0x${string}`) =>
  read.readContract({
    address: addressOf(CHAIN, "SenryoCore"),
    abi: CONTRACT_ABIS.SenryoCore,
    functionName: "triggerActive",
    args: [id],
  });
async function protect(tp: boolean, price: bigint) {
  const request = triggerOrder({
    user: user.address,
    marketId: 0,
    isLong: true,
    takeProfit: tp,
    triggerPrice18: price,
    sizeDelta: (1n << 128n) - 1n,
  });
  const result = await run(await placeTriggerRequest(sender, request), tp ? "TP" : "SL");
  const event = receiptEvents(result.receipt, "SenryoCore").find((e) => e.eventName === "TriggerPlaced");
  assert.ok(event, "decoded TriggerPlaced receipt");
  const id = (event.args as { orderId: `0x${string}` }).orderId;
  assert.equal(await active(id), true);
  return id;
}
const sl = await protect(false, (mark * 98n) / 100n);
const replacement = await protect(false, (mark * 99n) / 100n);
assert.equal(await active(sl), true, "new-before-retire");
await run(cancelTriggerRequest(CHAIN, sl), "retire old SL");
assert.equal(await active(sl), false);
const tp = await protect(true, (mark * 105n) / 100n);
await run(cancelTriggerRequest(CHAIN, tp), "cancel TP");
assert.equal(await active(tp), false);
const reduceSize = position.size / 2n;
const reduce = previewDecrease(market.risk, market.pv, position, reduceSize, 0n);
const reduced = await run(decreaseRequest(CHAIN, 0, true, reduceSize, reduce.execPrice18, 1), "partial reduce");
assert.ok(receiptEvents(reduced.receipt, "SenryoCore").some((e) => e.eventName === "PositionUpdated"));
assert.equal((await held())?.size, position.size - reduceSize);
const remaining = await held();
assert.ok(remaining);
const exit = previewDecrease(market.risk, market.pv, remaining, remaining.size, 0n);
const closed = await run(closeRequest(CHAIN, 0, true, exit.execPrice18, 1), "close");
assert.ok(receiptEvents(closed.receipt, "SenryoCore").some((e) => e.eventName === "PositionUpdated"));
assert.equal(await held(), undefined);
await run(cancelTriggerRequest(CHAIN, replacement), "cancel leftover SL");
// Reopen and execute a genuine trigger after crossing only this disposable fork's oracle.
await run(increaseRequest(CHAIN, 0, true, 10_000_000n, preview.execPrice18, 1), "reopen for trigger execution");
const stop = await protect(false, (mark * 999n) / 1000n);
await run(
  contractCall(CHAIN, "MirrorXAU", "pushAnswer", [(mark * 998n) / 1000n / 10n ** 10n], "pushAnswer"),
  "cross SL",
  oracle,
);
await run(contractCall(CHAIN, "SessionOracle", "observe", [0], "observe"), "observe crossing", oracle);
const triggered = await run(
  contractCall(CHAIN, "SenryoCore", "executeTrigger", [stop], "executeTrigger"),
  "execute SL",
  oracle,
);
assert.ok(
  receiptEvents(triggered.receipt, "SenryoCore").some(
    (e) => e.eventName === "PositionUpdated" && (e.args as { kind: number }).kind === 5,
  ),
);
assert.equal(await held(), undefined);
assert.equal(await active(stop), false);
console.log(
  "PASS isolated open, protection replace/cancel, reduce, close receipts and actual SL execution; no shared reset or public transaction",
);
