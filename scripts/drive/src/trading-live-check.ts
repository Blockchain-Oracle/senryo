/** biome-ignore-all lint/style/noMagicNumbers: Exact regression and protocol boundary assertions. */
import assert from "node:assert/strict";
import { contractCall } from "@senryo/chain";
import {
  createReviewLease,
  type MoneyOperation,
  type OperationRecord,
  preparedWithFee,
  requireReviewedFee,
  triggerBudgetSteps,
  withReviewedNetworkFee,
} from "@senryo/query";
import { MovementBaseline } from "../../../apps/mobile/src/feedback/movement.ts";
import { priceTickFresh } from "../../../packages/query/src/markets.ts";
import { confirmedFeedback } from "../../../packages/query/src/operation-feedback.ts";
import {
  cancelProtectionSpec,
  mayRetireProtection,
  nextProtectionRequest,
  PerplProtectionJournal,
  perplProtectionSpec,
  reconcileProtection,
} from "../../../packages/query/src/perpl-protection.ts";
import { PerplPriceStream } from "../../../packages/query/src/perpl-stream.ts";
import { PriceStore } from "../../../packages/query/src/price-store.ts";

const store = new PriceStore();
const tick = (updatedAt: bigint, price18: bigint, symbol = "XAU", chainId = 10143 as const) => ({
  chainId,
  marketId: 0,
  symbol,
  price18,
  latest18: price18,
  status: "OPEN" as const,
  updatedAt,
  spreadBps: 0n,
  receivedAt: Date.now(),
});
store.push(tick(20n, -20n));
store.push(tick(19n, 19n));
await new Promise((r) => setTimeout(r, 50));
assert.equal(store.get(10143, "XAU")?.price18, -20n, "raw signed newer pending wins");
store.push(tick(18n, 18n));
store.push({ ...tick(20n, -20n), status: "CLOSED" });
store.push(tick(1n, 1n, "XAG"));
await new Promise((r) => setTimeout(r, 50));
assert.equal(store.get(10143, "XAU")?.updatedAt, 20n);
assert.equal(store.get(10143, "XAU")?.status, "CLOSED");
assert.equal(store.get(10143, "XAU")?.samples?.length, 1, "equal status round isn't history");
assert.equal(store.get(10143, "XAG")?.updatedAt, 1n);
const operation: OperationRecord = {
  version: 1,
  id: "op",
  key: "key",
  account: "0xabc",
  chainId: 10143,
  kind: "perpl",
  plannedActions: ["perplOrder"],
  outcome: "partial",
  reviewedIntent: {},
  steps: [{ action: "perplOrder", hash: "0x123", outcome: "completed" }],
  createdAt: 1,
  updatedAt: 2,
};
assert.deepEqual(confirmedFeedback(operation), [], "EVM success is not fill");
const orderStep = operation.steps[0];
assert.ok(orderStep);
orderStep.facts = [{ event: "ImmediateOrCancelExecuted", contract: "exchange", values: { unmatchedLotLNS: "10" } }];
assert.deepEqual(confirmedFeedback(operation), [], "IOC no-fill is silent");
orderStep.facts.push(
  { event: "TakerOrderFilledV2", contract: "exchange", values: { lotLNS: "2" } },
  { event: "PositionDecreased", contract: "exchange", values: {} },
);
const partial = confirmedFeedback(operation);
assert.equal(partial[0]?.semantic, "reduce");
assert.deepEqual(
  confirmedFeedback({ ...operation, outcome: "completed" }),
  partial,
  "completion enrichment has same fill identity",
);
assert.deepEqual(
  confirmedFeedback(JSON.parse(JSON.stringify(operation))),
  partial,
  "durable identity survives relaunch",
);
const review = {
  account: 1,
  market: 2,
  position: 3,
  side: "long" as const,
  lots: 4n,
  triggerPNS: 100n,
  limitPNS: 99n,
  slippageBps: 50,
  source: "mark" as const,
  kind: "sl" as const,
  leverageHundredths: 1000,
  feeEstimateCNS: 100n,
  feeCeilingCNS: 110n,
};
const spec = perplProtectionSpec(review, 8);
assert.equal(spec.tpc, 4);
assert.equal(spec.lb, 0);
assert.equal(spec.t, 3);
assert.equal(spec.lp, 3);
assert.equal(spec.s, 4);
assert.throws(() => perplProtectionSpec({ ...review, lots: BigInt(Number.MAX_SAFE_INTEGER) + 1n }, 8));
assert.equal(nextProtectionRequest(10, 11), 12);
const intent = { review, spec, state: "pending" as const };
assert.equal(mayRetireProtection(intent), false, "admission is insufficient");
assert.equal(reconcileProtection(intent, { authenticated: false, account: 1, request: 8, status: 8 }).state, "unknown");
const active = reconcileProtection(intent, { authenticated: true, account: 1, request: 8, status: 8 });
assert.equal(mayRetireProtection(active), true);
assert.equal(cancelProtectionSpec(active, 9, 12).t, 5);
const baseline = new MovementBaseline();
assert.equal(baseline.observe("position", 100000, 0n, 100000, true), undefined);
assert.equal(baseline.observe("position", 101000, 2000000n, 101000, true), "up");
assert.equal(baseline.observe("position", 102000, -2000000n, 102000, true), undefined, "cooldown");
assert.equal(baseline.observe("position", 150000, 10000000n, 150000, true), undefined, "reconnect gap baseline");
assert.equal(baseline.observe("position", 151000, -10000000n, 151000, false), undefined, "background silence");
assert.equal(baseline.observe("position", 152000, 10000000n, 152000, true), undefined, "foreground baseline");
console.log(
  "PASS source ordering/equal status/raw signed history, no-fill and semantic fill identity, exact pinned protection and authenticated activation gates, movement freshness/cooldown/baseline",
);

assert.equal(
  priceTickFresh({ ...tick(1n, 1n), receivedAt: 100000 }, 100000),
  false,
  "new receipt cannot refresh old source",
);
assert.equal(priceTickFresh({ ...tick(100n, 1n), receivedAt: 100000 }, 100000), true);
const durable = new Map<string, string>();
const journal = new PerplProtectionJournal(
  {
    get: (key) => durable.get(key),
    set: (key, value) => {
      durable.set(key, value);
    },
  },
  "10143:owner:protection",
);
const prepared = journal.prepare(review, 20);
assert.equal(journal.read()?.spec.rq, 21);
assert.throws(() => journal.prepare(review, 20), /Reconcile/);
journal.save(reconcileProtection(prepared, { authenticated: true, account: 1, request: 21, status: 8 }));
const replaced = journal.prepare(review, 21, 21);
assert.equal(replaced.spec.rq, 22);
assert.equal(journal.read(21)?.state, "untriggered", "replaced order remains recoverable");
let polls = 0;
let source = Date.now();
const stream = new PerplPriceStream(10143, async () => {
  polls += 1;
  return { mt: 9, d: { 16: { mrk: 600000, at: { t: source } } } };
});
const offA = stream.subscribe(() => undefined);
const offB = stream.subscribe(() => undefined);
await new Promise((r) => setTimeout(r, 50));
assert.equal(polls, 1, "deduplicated subscribers");
const firstSource = source;
source -= 100;
await new Promise((r) => setTimeout(r, 550));
assert.equal(stream.get(16)?.at, firstSource, "old Perpl source ignored");
stream.setActive(false);
assert.equal(stream.getConnection(), "background");
const paused = polls;
await new Promise((r) => setTimeout(r, 550));
assert.equal(polls, paused, "background polling stops");
offA();
offB();
console.log(
  "PASS durable same-rq protection recovery, distinct source age, deduplicated Perpl observers and background cleanup",
);

const lease = createReviewLease("10143:owner:gold:long:10:1000");
const captured = lease.capture();
let finish: (() => void) | undefined;
const preparing = new Promise<void>((resolve) => {
  finish = resolve;
}).then(() => captured());
lease.update("10143:owner:gold:long:11:1000");
finish?.();
await assert.rejects(preparing, /changed/);
assert.throws(() => requireReviewedFee("exact", undefined, true), /complete network fee/);
assert.throws(() => requireReviewedFee("exact", { id: "old", fee: "1 MON" }, false), /complete network fee/);
assert.throws(() => requireReviewedFee("exact", { id: "exact", fee: "1 MON" }, true), /complete network fee/);
const baseRequest = contractCall(10143, "MockAUSD", "faucet", [], "faucet");
const indexes: number[] = [];
const moneyOp: MoneyOperation = {
  steps: [{ action: "faucet", label: "Open", request: baseRequest, build: async () => baseRequest }],
  reviewedIntent: { reviewId: "exact" },
  revalidate: async (index) => {
    indexes.push(index);
  },
};
assert.throws(() => withReviewedNetworkFee(moneyOp, "1 MON", []), /Incomplete/);
const frozen = withReviewedNetworkFee(moneyOp, "1 MON", [123n]);
assert.equal(frozen.steps[0]?.request.reviewedNetworkFeeWei, 123n);
assert.equal(
  (await frozen.steps[0]?.build?.())?.reviewedNetworkFeeWei,
  123n,
  "dynamic builder retains approved ceiling",
);
const paid = preparedWithFee(moneyOp, {
  kind: "top-up",
  needWei: 1n,
  haveWei: 1n,
  source: { address: baseRequest.to, symbol: "AUSD", decimals: 6, spare: 1000000n },
  amountIn: 500000n,
  quote: {} as never,
  steps: [{ action: "faucet", role: "fee", label: "Network fee", request: baseRequest }],
});
assert.ok(paid.ok);
await paid.op.revalidate(0);
await paid.op.revalidate(1);
assert.deepEqual(indexes, [0, 0], "top-up index remapping preserves original checks");
assert.ok(paid.op.stepUp, "network-fee swap requires passkey");
console.log(
  "PASS async exact-review invalidation, pending/failed/refetched fee refusal, dynamic ceilings and fee-top-up validator/passkey preservation",
);

const protectionBudget = triggerBudgetSteps(10143, "0x0000000000000000000000000000000000000001", 0, true, [
  { kind: "sl", price18: 100n },
]);
assert.equal(protectionBudget[0]?.request.meta?.kind, "protectionBudget");
assert.throws(() => protectionBudget[0]?.request.validate?.(), /cannot be signed/);
assert.equal(cancelProtectionSpec(active, 9, 12).s, 0);
console.log("PASS protection fee placeholders never sign and native cancel uses pinned zero-size cancel semantics");
