/**
 * Targeted check (security): the scoped signer end to end — the policy runs before every signature, a locked session
 * unlocks with exactly one prompt (which doubles as the D-037 confirmation), expiry follows TTL/idle, raw hashes and
 * 7702 authorizations never sign in session, typed data/messages only for our own formats.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createSecp256k1SigningSession } from "@category-labs/mera";
import { TESTNET_CHAIN_ID } from "@senryo/config";
import { senryoCoreAbi } from "@senryo/contracts";

import { type Address, encodeFunctionData, hexToBytes, parseTransaction, recoverTransactionAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";
import { MINUTES, SESSION_IDLE_MS, SESSION_TTL_MS } from "../src/constants.ts";
import { OutOfScopeError } from "../src/errors.ts";
import { scopeTargets } from "../src/policy/targets.ts";
import type { FaceIdMode, PolicyContext } from "../src/policy/types.ts";
import { type Clock, SessionManager } from "../src/session/manager.ts";
import { createScopedSigner } from "../src/session/signer.ts";
import { claimTypedData } from "../src/starter/typed-data.ts";
import { DEADLINE_S, FEE_WEI, GAS, HASH_BYTES, MARKET_XAU, NOW_MS, PRICE_E18, SIWE_NONCE, USD } from "./constants.ts";

const chainId = TESTNET_CHAIN_ID;
const core = scopeTargets(chainId).core as Address;

function fakeClock(start: number): Clock & { advance(ms: number): void } {
  let now = start;
  return {
    now: () => now,
    setTimeout: () => undefined,
    clearTimeout: () => {},
    advance(ms) {
      now += ms;
    },
  };
}

function harness(faceId: FaceIdMode = "off") {
  const key = generatePrivateKey();
  const address = privateKeyToAccount(key).address;
  const clock = fakeClock(NOW_MS);
  const manager = new SessionManager({ clock });
  const prompts: string[] = [];
  const start = () => manager.start(address, createSecp256k1SigningSession({ privateKey: hexToBytes(key) }));
  const context = (): PolicyContext => ({
    chainId,
    self: address,
    faceId,
    marketRoomUsd6: () => USD.tenThousand,
    equityUsd6: () => USD.thousand,
    marketLabel: () => "Gold",
  });
  const signer = createScopedSigner({
    manager,
    address,
    context,
    now: clock.now,
    unlock: async (p) => {
      prompts.push(`unlock:${p}`);
      start();
    },
    confirm: async (p) => {
      prompts.push(`confirm:${p}`);
    },
  });
  return { address, clock, manager, prompts, signer, start };
}

const tx = (notionalUsd: bigint) => ({
  chainId,
  type: "eip1559" as const,
  to: core,
  nonce: 0,
  gas: GAS,
  maxFeePerGas: FEE_WEI,
  maxPriorityFeePerGas: FEE_WEI,
  data: encodeFunctionData({
    abi: senryoCoreAbi,
    functionName: "increase",
    args: [MARKET_XAU, true, notionalUsd, PRICE_E18, DEADLINE_S],
  }),
});

test("in-scope trade signs with no prompt and recovers to the account", async () => {
  const h = harness();
  h.start();
  const raw = await h.signer.signTransaction(tx(USD.hundred));
  assert.equal(await recoverTransactionAddress({ serializedTransaction: raw as never }), h.address);
  assert.equal(parseTransaction(raw).to?.toLowerCase(), core.toLowerCase());
  assert.deepEqual(h.prompts, []);
});

test("locked → one unlock prompt that doubles as the Face ID confirmation", async () => {
  const h = harness("above-threshold");
  await h.signer.signTransaction(tx(USD.hundred));
  assert.deepEqual(h.prompts, ["unlock:Confirm long $100.00 Gold"]);
  await h.signer.signTransaction(tx(USD.hundred));
  assert.deepEqual(h.prompts, ["unlock:Confirm long $100.00 Gold", "confirm:Confirm long $100.00 Gold"]);
});

test("out of scope throws before any prompt or signature", async () => {
  const h = harness();
  h.start();
  await assert.rejects(
    () => h.signer.signTransaction(tx(USD.fiveHundred)),
    (e) => e instanceof OutOfScopeError && e.stepUp,
  );
  await assert.rejects(
    () => h.signer.sign?.({ hash: `0x${"11".repeat(HASH_BYTES)}` }) ?? Promise.reject(),
    OutOfScopeError,
  );
  await assert.rejects(
    () => h.signer.signAuthorization?.({ contractAddress: core, chainId, nonce: 0 }) ?? Promise.reject(),
    (e) => e instanceof OutOfScopeError && e.reason === "delegation",
  );
  assert.deepEqual(h.prompts, []);
});

test("idle and TTL lock the session (the key is ended, not kept)", async () => {
  const h = harness();
  h.start();
  h.clock.advance(SESSION_IDLE_MS);
  assert.equal(h.manager.snapshot().status, "unlocked");
  assert.equal(h.manager.live(), undefined);
  assert.deepEqual(h.manager.snapshot(), { status: "locked", address: h.address, reason: "idle" });
  // Staying active (a trade every 4 min) keeps the idle lock away, but not the absolute TTL.
  h.start();
  const step = SESSION_IDLE_MS - MINUTES;
  let elapsed = 0;
  while (elapsed + step < SESSION_TTL_MS) {
    h.clock.advance(step);
    elapsed += step;
    await h.signer.signTransaction(tx(USD.one));
    assert.equal(h.manager.snapshot().status, "unlocked");
  }
  h.clock.advance(SESSION_TTL_MS - elapsed);
  assert.equal(h.manager.live(), undefined);
  assert.deepEqual(h.manager.snapshot(), { status: "locked", address: h.address, reason: "ttl" });
  assert.deepEqual(h.prompts, []);
});

test("typed data: our Claim for self signs; other domains/users need step-up", async () => {
  const h = harness();
  h.start();
  const sig = await h.signer.signTypedData?.(claimTypedData(chainId, h.address, DEADLINE_S));
  assert.match(String(sig), /^0x[0-9a-f]{130}$/);
  const other = privateKeyToAccount(generatePrivateKey()).address;
  await assert.rejects(
    () => h.signer.signTypedData?.(claimTypedData(chainId, other, DEADLINE_S)) ?? Promise.reject(),
    OutOfScopeError,
  );
  const allowance = {
    domain: { name: "SenryoCore", version: "1", chainId, verifyingContract: core },
    types: { SpendAllowance: [{ name: "user", type: "address" }] },
    primaryType: "SpendAllowance",
    message: { user: h.address },
  } as const;
  await assert.rejects(() => h.signer.signTypedData?.(allowance) ?? Promise.reject(), OutOfScopeError);
});

test("messages: Senryo prefixes and short SIWE for our host only", async () => {
  const h = harness();
  h.start();
  assert.ok(await h.signer.signMessage({ message: "Senryo:push:token-abc" }));
  const siwe = (domain: string, ttl: number) =>
    createSiweMessage({
      address: h.address,
      chainId,
      domain,
      nonce: SIWE_NONCE,
      uri: `https://${domain}`,
      version: "1",
      issuedAt: new Date(h.clock.now()),
      expirationTime: new Date(h.clock.now() + ttl),
    });
  assert.ok(await h.signer.signMessage({ message: siwe("api.senryo.xyz", MINUTES) }));
  await assert.rejects(() => h.signer.signMessage({ message: siwe("evil.example", MINUTES) }), OutOfScopeError);
  await assert.rejects(() => h.signer.signMessage({ message: siwe("senryo.xyz", SESSION_TTL_MS) }), OutOfScopeError);
  await assert.rejects(() => h.signer.signMessage({ message: "Transfer all funds" }), OutOfScopeError);
});
