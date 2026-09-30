/**
 * Targeted check (money/security): the frozen derivation gives the same address from the same PRF output on the web
 * code path (@scure JS PBKDF2) and the native code path (a Node-compatible `pbkdf2Sync`, the API
 * react-native-quick-crypto exposes on Hermes), and both match a standard BIP-44 wallet import of the 24 words.
 * Run: `pnpm --filter @senryo/account check`.
 */
import assert from "node:assert/strict";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { test } from "node:test";
import { mnemonicToAccount } from "viem/accounts";
import { mnemonicToSeed, openAccount, type Pbkdf2Sha512, prfOutputToMnemonic } from "../src/derive.ts";

const SAMPLES = 24;
const PRF_BYTES = 32;

/** The native path: identical signature to react-native-quick-crypto's `pbkdf2Sync(..., "sha512")`. */
const nativePbkdf2: Pbkdf2Sha512 = (password, salt, rounds, keyLength) =>
  new Uint8Array(pbkdf2Sync(password, salt, rounds, keyLength, "sha512"));

function addressOf(prf: Uint8Array, native: boolean): string {
  const opened = openAccount(Uint8Array.from(prf), native ? { pbkdf2: nativePbkdf2 } : {});
  opened.session.end();
  return opened.address;
}

test("BIP-39 vector: all-zero PRF → 'abandon × 23 art'", () => {
  const words = prfOutputToMnemonic(new Uint8Array(PRF_BYTES)).split(" ");
  assert.equal(words.length, SAMPLES);
  assert.deepEqual(new Set(words.slice(0, -1)), new Set(["abandon"]));
  assert.equal(words.at(-1), "art");
});

test("seed: native PBKDF2 path == @scure JS path", () => {
  for (let i = 0; i < SAMPLES; i++) {
    const phrase = prfOutputToMnemonic(new Uint8Array(randomBytes(PRF_BYTES)));
    assert.deepEqual(mnemonicToSeed(phrase, nativePbkdf2), mnemonicToSeed(phrase));
  }
});

test("same PRF → same address on web and native paths, and == a standard wallet import of the phrase", () => {
  for (let i = 0; i < SAMPLES; i++) {
    const prf = new Uint8Array(randomBytes(PRF_BYTES));
    const web = addressOf(prf, false);
    const native = addressOf(prf, true);
    const wallet = mnemonicToAccount(prfOutputToMnemonic(prf)).address; // m/44'/60'/0'/0/0 (MetaMask default)
    assert.equal(native, web);
    assert.equal(wallet, web);
  }
});

test("fixed vector stays fixed (all-zero PRF)", () => {
  // Changing this means every Senryo account moved. Never update it to make the check pass.
  assert.equal(addressOf(new Uint8Array(PRF_BYTES), false), "0xF278cF59F82eDcf871d630F28EcC8056f25C1cdb");
});

test("openAccount zeroes the PRF buffer it was given", () => {
  const prf = new Uint8Array(randomBytes(PRF_BYTES));
  openAccount(prf).session.end();
  assert.ok(prf.every((b) => b === 0));
});

test("an ended session refuses to sign (Mera SESSION_ENDED)", async () => {
  const opened = openAccount(new Uint8Array(randomBytes(PRF_BYTES)));
  opened.session.end();
  await assert.rejects(() => opened.session.signDigest(new Uint8Array(PRF_BYTES)), /ended/i);
});
