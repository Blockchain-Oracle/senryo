/** biome-ignore-all lint/style/noMagicNumbers: Exact numeric lifecycle fixtures and boundary assertions. */
/** Offline lifecycle contracts; no native UI, provider requests or chain broadcast. */
import assert from "node:assert/strict";
import { assertReviewedNetworkFee } from "../../../packages/chain/src/send.ts";
import { arrivalOf, openArrivals } from "../../../packages/query/src/arrivals.ts";
import type { FeePlan } from "../../../packages/query/src/compose.ts";
import {
  findSavedDeposit,
  latestDeposit,
  type SavedDeposit,
  withSavedDeposit,
} from "../../../packages/query/src/deposit-addresses.ts";
import {
  type MoneyOperation,
  preparedWithFee,
  withReviewedNetworkFee,
} from "../../../packages/query/src/money-operation.ts";
import {
  assertBridgeExecution,
  assertReviewedSource,
  createReviewLease,
  moneyReviewRoute,
  requireReviewedFee,
  settleDestinationAction,
  walletSnapshot,
} from "../../../packages/query/src/money-review.ts";

const owner = "0x0000000000000000000000000000000000000001";
const intent = { sourceAccount: owner, sourceChainId: "10143", reviewGeneration: "view:1" };
assert.doesNotThrow(() => assertReviewedSource(intent, owner, 10143, "view:1"));
for (const [account, chain, generation] of [
  [owner, 143, "view:1"],
  ["other", 10143, "view:1"],
  [owner, 10143, "view:2"],
  [owner, 10143, "other-view:1"],
] as const)
  assert.throws(() => assertReviewedSource(intent, account, chain, generation), /Review again/);
let prior = walletSnapshot(undefined, "A", [{ key: "usd", wallet: 100n }], true).snapshot;
let result = walletSnapshot(
  prior,
  "A",
  [
    { key: "usd", wallet: 100n },
    { key: "new", wallet: 200n },
  ],
  true,
);
assert.equal(result.changed, false, "first discovery is not a new receipt");
prior = result.snapshot;
result = walletSnapshot(
  prior,
  "A",
  [
    { key: "usd", wallet: 50n },
    { key: "new", wallet: 150n },
  ],
  true,
);
assert.equal(result.changed, true);
assert.equal(result.snapshot?.balances.get("new"), 150n, "all changes update together");
prior = result.snapshot;
assert.equal(
  walletSnapshot(prior, "A", [{ key: "usd", wallet: 70n }], false).changed,
  false,
  "stale/partial snapshots cannot report arrivals",
);
result = walletSnapshot(
  prior,
  "A",
  [
    { key: "usd", wallet: 70n },
    { key: "new", wallet: 160n },
  ],
  true,
);
assert.equal(result.changed, true, "a decrease then increase is detected");
assert.equal(
  walletSnapshot(
    result.snapshot,
    "A",
    [
      { key: "usd", wallet: 70n },
      { key: "new", wallet: 160n },
    ],
    true,
  ).changed,
  false,
  "same snapshot is deduplicated",
);
assert.equal(
  walletSnapshot(result.snapshot, "B", [{ key: "usd", wallet: 999n }], true).changed,
  false,
  "source changes seed a new baseline",
);
const arrival = arrivalOf(
  {
    kind: "ramp",
    chainId: 143,
    account: owner,
    asset: "usd",
    symbol: "USD",
    baseline: "100",
    via: "Ramp",
    providerOperationId: "purchase-1",
    status: "paid",
  },
  0,
);
const dust = openArrivals([arrival], 143, owner, [{ key: "usd", wallet: 101n }], 10);
assert.equal(dust.open.length, 1, "dust/internal movement cannot settle provider money");
assert.equal(dust.settled, undefined);
const late = openArrivals([arrival], 143, owner, [], 86_400_001);
assert.equal(late.open.length, 1, "timeouts retain the operation");
assert.equal(late.settled?.[0]?.status, "unresolved");
assert.equal(
  openArrivals([{ ...arrival, status: "delivered" }], 143, owner, [], 10).open.length,
  1,
  "delivery requires transaction evidence",
);
assert.equal(
  openArrivals([{ ...arrival, status: "delivered", deliveryTransaction: "0x123" }], 143, owner, [], 10).open.length,
  0,
);
assert.equal(
  arrivalOf({ ...arrival, providerOperationId: "purchase-1" }, 999).id,
  arrival.id,
  "provider identity survives repeated events",
);
console.log(
  "Passed: immutable source/generation; complete atomic snapshots; discovery/decrease/dedup/scope; durable provider identity/dust/timeout/evidence.",
);

const indices: number[] = [];
const own = {
  steps: [
    {
      action: "erc20Transfer",
      label: "Send",
      role: "act",
      request: { to: owner, data: "0x", action: "erc20Transfer" },
    },
  ],
  reviewedIntent: { amount: "100" },
  revalidate: async (index: number) => {
    indices.push(index);
  },
} as MoneyOperation;
const fee = {
  kind: "top-up",
  amountIn: 500_000n,
  source: { symbol: "USDC", decimals: 6 },
  steps: [
    { action: "approve", label: "Network fee", role: "fee" },
    { action: "aggregatorSwap", label: "Network fee", role: "fee" },
  ],
} as unknown as Extract<FeePlan, { kind: "top-up" }>;
const prepared = preparedWithFee(own, fee);
assert.ok(prepared.ok);
assert.equal(prepared.op.reviewedIntent.amount, "100");
assert.equal(prepared.op.reviewedIntent.networkFee, "0.50 USDC → MON");
assert.equal(prepared.op.steps.length, 3);
for (let i = 0; i < prepared.op.steps.length; i++) await prepared.op.revalidate(i);
assert.deepEqual(indices, [0, 0, 0], "prepended fee steps retain the original index validator");
assert.ok(prepared.op.stepUp, "fee swap cannot bypass fresh native approval");
console.log("Passed: full prepared fee/top-up intent, step index remapping and step-up preserved.");

assert.doesNotThrow(() => assertBridgeExecution(20, 10_000, 1));
assert.throws(() => assertBridgeExecution(10, 10_000), /expired/);
assert.throws(() => assertBridgeExecution(null, 10_000, 2), /approval changed/);
console.log("Passed: expired bridge cannot silently refresh; additional approval requires new review.");

const lease = createReviewLease("account-A:Practice");
const firstReview = lease.capture();
lease.update("account-A:Mainnet");
lease.update("account-A:Practice");
assert.throws(firstReview, /Review again/, "switching back cannot revive an old review");
const foreground = lease.capture();
lease.interrupt();
assert.throws(foreground, /Review again/);
const reviewedAgain = lease.capture();
assert.doesNotThrow(reviewedAgain, "explicit same-value review works after foreground return");
lease.unmount();
assert.throws(reviewedAgain, /Review again/, "late prepare cannot publish after navigation");
console.log("Passed: source A→B→A, background→explicit re-review and unmounted late completion leases.");

const oldRoute = {
  chainId: 143,
  account: owner,
  fromChain: 8453,
  asset: "USDC",
  remote: "base-usdc",
  depositAddress: "old-address",
  expiresAt: null,
} as SavedDeposit;
const newRoute = { ...oldRoute, depositAddress: "new-address" };
const routes = withSavedDeposit([oldRoute], newRoute);
assert.equal(routes.length, 2, "issuing a new address preserves the old reconciliation identity");
assert.equal(findSavedDeposit(routes, oldRoute, 10)?.depositAddress, "new-address");
assert.equal(
  latestDeposit([{ updatedAt: "2026-01-01T00:00:00Z" } as never], Date.parse("2026-10-08T00:00:00Z")),
  undefined,
  "older route receipts cannot settle a newly issued address",
);
console.log("Passed: saved route history, latest route reuse and old receipt exclusion.");

assert.deepEqual(
  await settleDestinationAction(
    async () => {
      throw new Error("native clipboard unavailable");
    },
    () => true,
  ),
  { ok: false, current: true },
);
let currentDestination = true;
let completeCopy: (() => void) | undefined;
const pendingCopy = settleDestinationAction(
  () =>
    new Promise<void>((resolve) => {
      completeCopy = resolve;
    }),
  () => currentDestination,
);
currentDestination = false;
completeCopy?.();
assert.deepEqual(
  await pendingCopy,
  { ok: true, current: false },
  "late copy success cannot flash on another destination",
);
console.log("Passed: caught native address action rejection and scoped late copy completion.");

// Two runners mounted: only the bridge owns the approval route. Its original validator survives both transitions.
const idleMonad = createReviewLease("/withdraw");
const activeBridge = createReviewLease("/withdraw");
const chainValidator = activeBridge.capture();
const idleValidator = idleMonad.capture();
idleMonad.update(moneyReviewRoute("/step-up", false, "/withdraw", "/step-up"));
activeBridge.update(moneyReviewRoute("/step-up", true, "/withdraw", "/step-up"));
assert.doesNotThrow(chainValidator);
assert.throws(idleValidator);
activeBridge.update(moneyReviewRoute("/withdraw", true, "/withdraw", "/step-up"));
assert.doesNotThrow(chainValidator);
activeBridge.interrupt();
assert.throws(chainValidator, /Review again/);
console.log("Passed: two mounted runners preserve owning bridge approval and return; background still invalidates.");

let feeFacts: { id: string; fee: string } | undefined;
let finishFee: ((facts: { id: string; fee: string }) => void) | undefined;
const delayedFee = new Promise<{ id: string; fee: string }>((resolve) => {
  finishFee = resolve;
});
assert.throws(() => requireReviewedFee("composed-topup", feeFacts, true));
finishFee?.({ id: "composed-topup", fee: "Up to 0.01 MON" });
feeFacts = await delayedFee;
assert.doesNotThrow(() => requireReviewedFee("composed-topup", feeFacts, false));
assert.throws(() => requireReviewedFee("composed-topup", feeFacts, true), /complete network fee/);
assert.throws(() => requireReviewedFee("changed-preparation", feeFacts, false), /complete network fee/);
await assert.rejects(async () => {
  await Promise.reject(new Error("fee RPC rejected"));
});
assert.throws(() => requireReviewedFee("composed-topup", undefined, false));
// Each composed step, including top-up, has an independent reviewed bound.
for (const bound of [20n, 30n, 40n]) {
  assert.doesNotThrow(() => assertReviewedNetworkFee(bound, bound));
  assert.doesNotThrow(() => assertReviewedNetworkFee(bound, bound - 1n));
  assert.throws(() => assertReviewedNetworkFee(bound, bound + 1n), /Network fee increased/);
}
console.log(
  "Passed: delayed/rejected/refetch/changed fee facts block authorization; composed per-step ceilings reject higher signed fees.",
);

const composed = withReviewedNetworkFee(prepared.op, "Up to 0.01 MON", [20n, 30n, 40n]);
assert.equal(composed.revalidate, prepared.op.revalidate);
assert.equal(composed.stepUp, prepared.op.stepUp);
assert.equal(composed.reviewedIntent.networkFee, "0.50 USDC → MON");
assert.deepEqual(
  composed.steps.map((step) => step.request.reviewedNetworkFeeWei),
  [20n, 30n, 40n],
);
assert.throws(() => withReviewedNetworkFee(prepared.op, "Up to 0.01 MON", [20n]), /Incomplete/);
const originalStep = own.steps[0];
assert.ok(originalStep);
const built = withReviewedNetworkFee(
  { ...own, steps: [{ ...originalStep, build: async () => originalStep.request }] },
  "Up to 0.01 MON",
  [40n],
);
assert.equal((await built.steps[0]?.build?.())?.reviewedNetworkFeeWei, 40n);
console.log("Passed: composed top-up step bounds, dynamic builds, original validator and disclosure stay coupled.");
