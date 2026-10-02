/** Money boundary checks: authentication cannot broadcast an intent whose review changed. No UI renderer. */

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  type FeeCache,
  LocalNonceSource,
  type ReadClient,
  type Sender,
  sendTx,
  signerFromPrivateKey,
  type TxRequest,
} from "@senryo/chain";
import { GAS_LIMITS, TESTNET_CHAIN_ID } from "@senryo/config";

const INITIAL_NONCE = 7;
const KEY_BYTES = 32;
const DESTINATION = "0x0000000000000000000000000000000000000001";
const account = signerFromPrivateKey(`0x${randomBytes(KEY_BYTES).toString("hex")}`, "review-guard-check");
const read = { getTransactionCount: async () => INITIAL_NONCE } as unknown as ReadClient;
const nonces = new LocalNonceSource(read);
let signatures = 0;
let journalWrites = 0;
let broadcasts = 0;
let reviewed = true;
const sender: Sender = {
  chainId: TESTNET_CHAIN_ID,
  read,
  nonces,
  account: {
    ...account,
    signTransaction: async (transaction, options) => {
      signatures += 1;
      const raw = await account.signTransaction(transaction, options);
      reviewed = false; // User changes account/details while the authentication prompt is up.
      return raw;
    },
  },
  fees: { get: async () => ({ maxFeePerGas: 1n, maxPriorityFeePerGas: 0n }) } as FeeCache,
  broadcast: [
    {
      sendRawTransactionSync: async () => {
        broadcasts += 1;
        throw new Error("Unexpected broadcast");
      },
    } as unknown as ReadClient,
  ],
  journal: {
    put: async () => {
      journalWrites += 1;
    },
    update: async () => {},
    list: async () => [],
    remove: async () => {},
  },
};
const request: TxRequest = {
  to: DESTINATION,
  data: "0x",
  action: "erc20Transfer",
  fixedGas: GAS_LIMITS.erc20Transfer,
  validate: () => {
    if (!reviewed) throw new Error("Review changed");
  },
};
reviewed = false;
await assert.rejects(sendTx(sender, request), /Review changed/);
assert.equal(signatures, 0, "invalid review never requests authentication");
reviewed = true;
await assert.rejects(sendTx(sender, request), /Review changed/);
assert.equal(signatures, 1, "review is checked again after authentication");
assert.equal(journalWrites, 0, "invalidated local signature never enters a broadcast journal");
assert.equal(broadcasts, 0);
const nonce = await nonces.withNext(account.address, async (value) => value);
assert.equal(nonce, INITIAL_NONCE, "cancelled preparation does not consume the local nonce");
console.log("Passed: pre-sign guard; post-auth guard; no journal/broadcast; cancelled nonce released.");
