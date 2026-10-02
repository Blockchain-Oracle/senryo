/** Money/recovery contracts, no UI renderer or snapshots. Runs offline. */
import assert from "node:assert/strict";
import { pinRead, type ReadClient, sumPortfolio, tradingDisplayValue } from "@senryo/chain";
import { MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "@senryo/config";
import { beginOperation, builtOperation, progressOperation } from "../../../packages/query/src/operation-progress.ts";
import {
  configureOperationStorage,
  operationOutcome,
  operationsFor,
  readOperation,
  writeOperation,
} from "../../../packages/query/src/operations.ts";

const EQUITY_AFTER_DEBT_AND_HOLDS = 800_000n;
const RESERVED_HOLDS = 50_000n;
const GROSS_COLLATERAL = 1_000_000n;
const RISK_COLLATERAL = 950_000n;
const EXPECTED_DISPLAY = 900_000n;
const KNOWN_WALLET = 250_000n;
const SELF = "0x0000000000000000000000000000000000000001";
const OTHER = "0x0000000000000000000000000000000000000002";
const BLOCK = 12n;
const data = new Map<string, string>();
configureOperationStorage({
  get: (key) => data.get(key),
  set: (key, value) => {
    data.set(key, value);
  },
  keys: () => [...data.keys()],
});
const approval = builtOperation(
  beginOperation(
    "pool",
    SELF,
    TESTNET_CHAIN_ID,
    "approve",
    { amount: "100", source: "wallet", destination: "pool" },
    undefined,
    ["approve", "lpDeposit"],
  ),
  { to: OTHER, data: "0x", action: "approve", meta: { amount: "100" } },
);
const approved = {
  ...progressOperation(approval, "finalized", Date.now(), "0x01"),
  steps: approval.steps.map((step) => ({ ...step, outcome: "completed" as const, hash: "0x01", blockNumber: "10" })),
};
assert.equal(approved.outcome, "pending", "a finalized approval is not a completed deposit");
writeOperation(approved, false);
const deposit = builtOperation(beginOperation("pool", SELF, TESTNET_CHAIN_ID, "lpDeposit", undefined, approved), {
  to: OTHER,
  data: "0x1234",
  action: "lpDeposit",
  meta: { amount: "100" },
});
assert.throws(() => beginOperation("pool", SELF, TESTNET_CHAIN_ID, "lpDeposit", { amount: "999" }, approved));
assert.throws(() => builtOperation(deposit, { to: OTHER, data: "0x", action: "lpDeposit", meta: { amount: "999" } }));
const failed = progressOperation(deposit, "failed", Date.now());
assert.equal(failed.reviewedIntent.amount, "100", "a later builder cannot silently rewrite reviewed amount");
assert.equal(failed.steps[0]?.outcome, "completed", "a failed deposit preserves the completed approval");
assert.equal(failed.steps[0]?.blockNumber, "10", "each transaction keeps its own finalized block");
assert.equal(failed.steps[1]?.outcome, "not-sent");
assert.equal(failed.outcome, "partial");
assert.equal(
  operationOutcome(failed.steps, failed.plannedActions),
  "partial",
  "recovering an earlier approval cannot finish a failed deposit",
);
writeOperation(failed, false);
assert.equal(readOperation(failed.id)?.steps.length, 2, "id lookup updates with all steps");
assert.equal(operationsFor(TESTNET_CHAIN_ID, SELF).length, 1, "operation history deduplicates step keys");
assert.equal(operationsFor(MAINNET_CHAIN_ID, SELF).length, 0, "network history never leaks between modes");
assert.throws(() => beginOperation("pool", OTHER, TESTNET_CHAIN_ID, "lpDeposit", undefined, approved));
assert.throws(() => beginOperation("pool", SELF, MAINNET_CHAIN_ID, "lpDeposit", undefined, approved));
const pending = progressOperation(deposit, "signed", Date.now(), "0x02");
assert.equal(
  progressOperation(pending, "failed", Date.now()).steps[1]?.outcome,
  "pending",
  "an uncertain signed result never becomes retryable",
);
// Held spending capacity is owned money; debt/fees already in net equity remain deductions.
assert.equal(
  tradingDisplayValue(EQUITY_AFTER_DEBT_AND_HOLDS, RESERVED_HOLDS, GROSS_COLLATERAL, RISK_COLLATERAL),
  EXPECTED_DISPLAY,
);
assert.deepEqual(
  sumPortfolio([
    { name: "wallet", valueUsd6: KNOWN_WALLET, missing: [] },
    { name: "trading", valueUsd6: undefined, missing: ["price"] },
  ]),
  { totalUsd6: KNOWN_WALLET, quality: "partial" },
);
const methods = ["readContract", "multicall", "getBalance"];
const observed: Record<string, unknown>[] = [];
const mock = Object.fromEntries(
  methods.map((method) => [
    method,
    (args: Record<string, unknown>) => {
      observed.push(args);
      return Promise.resolve(0n);
    },
  ]),
) as unknown as ReadClient;
const read = pinRead(mock, BLOCK);
await read.getBalance({ address: SELF, blockTag: "latest" });
await read.readContract({ address: SELF, abi: [], functionName: "balanceOf", blockNumber: 1n });
await read.multicall({ contracts: [], blockTag: "finalized" });
assert(
  observed.every((args) => args.blockNumber === BLOCK && !Object.hasOwn(args, "blockTag")),
  "all money sources are pinned even if a nested read supplies another tag or block",
);
console.log(
  "Passed: immutable intent; partial approval; scoped durable history; signed unknown; portfolio debt/haircut/unknown; coherent block reads.",
);
