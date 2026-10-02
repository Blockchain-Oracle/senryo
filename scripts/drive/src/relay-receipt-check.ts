/** Offline money checks. Relay labels cannot substitute for finalized, correctly scoped credit receipts. */
import assert from "node:assert/strict";
import type { RelayResponse } from "@senryo/api-client";
import { addressOf, encodeAbiParameters, keccak256, stringToHex, type TransactionReceipt } from "@senryo/chain";
import { MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "@senryo/config";
import { configureOperationStorage, type QueryEnv } from "@senryo/query";
import { relayOperation, relayProgress, relaySubmitted } from "../../../apps/mobile/src/lib/account/relay-operation.ts";

const USER = "0x0000000000000000000000000000000000000001";
const OTHER = "0x0000000000000000000000000000000000000002";
const HASH_BYTES = 32;
const HASH = `0x${"11".repeat(HASH_BYTES)}` as const;
const OTHER_HASH = `0x${"22".repeat(HASH_BYTES)}` as const;
const CREDIT = 25_000_000n;
const BLOCK = 10n;
const chainId = TESTNET_CHAIN_ID;
const core = addressOf(chainId, "SenryoCore");
const drip = addressOf(chainId, "StarterDrip");
const token = addressOf(chainId, "MockAUSD");
const topic = (address: `0x${string}`) => encodeAbiParameters([{ type: "address" }], [address]);
const signature = keccak256(stringToHex("Deposited(address,address,address,uint256,uint8,uint64)"));
const depositLog = (user: `0x${string}` = USER, emitter = core, payer = drip, amount = CREDIT) => ({
  address: emitter,
  topics: [signature, topic(user), topic(payer), topic(token)],
  data: encodeAbiParameters([{ type: "uint256" }, { type: "uint8" }, { type: "uint64" }], [amount, 1, 1n]),
});
let receipt = {
  transactionHash: HASH,
  blockHash: HASH,
  blockNumber: BLOCK,
  to: drip,
  status: "success",
  logs: [depositLog()],
} as unknown as TransactionReceipt;
let finalized = BLOCK;
let canonical = HASH as `0x${string}`;
const env = {
  chainId,
  read: {
    getTransactionReceipt: async () => receipt,
    getBlock: async (args: { blockTag?: string }) => (args.blockTag ? { number: finalized } : { hash: canonical }),
  },
} as unknown as QueryEnv;
const store = new Map<string, string>();
configureOperationStorage({ get: (key) => store.get(key), set: (key, value) => void store.set(key, value) });
const record = relaySubmitted(relayOperation(env, USER, "voucher"));
assert.throws(() => relayOperation(env, USER, "voucher"), /still pending/);
const relay: RelayResponse = {
  relayId: "00000000-0000-4000-8000-000000000001",
  kind: "voucher",
  chainId,
  user: USER,
  txHash: HASH,
  stage: "finalized",
  blockNumber: BLOCK,
  nativeWei: 0n,
  creditUsd6: CREDIT,
  createdAt: new Date(record.createdAt).toISOString(),
};
const progress = () => relayProgress(env, record, relay, false);
await assert.rejects(relayProgress(env, record, { ...relay, user: OTHER }, false), /scope/);
await assert.rejects(relayProgress(env, record, { ...relay, chainId: MAINNET_CHAIN_ID }, false), /scope/);
finalized = BLOCK - 1n;
assert.equal((await progress()).outcome, "pending", "unfinalized receipt cannot complete a deposit");
finalized = BLOCK;
canonical = OTHER_HASH;
assert.equal((await progress()).outcome, "pending", "noncanonical receipt cannot complete a deposit");
canonical = HASH;
receipt = { ...receipt, to: OTHER };
assert.equal((await progress()).outcome, "pending", "unrelated transaction cannot complete a relay");
receipt = { ...receipt, to: drip, logs: [depositLog(OTHER)] as TransactionReceipt["logs"] };
assert.equal((await progress()).outcome, "pending", "another account's credit cannot complete this deposit");
receipt = { ...receipt, logs: [depositLog(USER, OTHER)] as TransactionReceipt["logs"] };
assert.equal((await progress()).outcome, "pending", "lookalike event emitter cannot complete this deposit");
receipt = { ...receipt, logs: [depositLog(USER, core, OTHER)] as TransactionReceipt["logs"] };
assert.equal((await progress()).outcome, "pending", "another payer's credit cannot complete this relay");
receipt = { ...receipt, logs: [depositLog(USER, core, drip, CREDIT - 1n)] as TransactionReceipt["logs"] };
assert.equal((await progress()).outcome, "pending", "insufficient finalized credit cannot complete a deposit");
receipt = { ...receipt, logs: [depositLog()] as TransactionReceipt["logs"] };
const completed = await progress();
assert.equal(completed.outcome, "completed");
assert.equal(completed.steps[0]?.facts?.[0]?.values.amount, CREDIT.toString(), "decode actual contract amount field");
receipt = { ...receipt, status: "reverted", logs: [] };
assert.equal((await progress()).outcome, "reverted");
console.log(
  "Passed: pending duplicate guard; account/chain scope; finality/canonical/target/emitter/payer checks; actual credited amount; reverted receipt.",
);
