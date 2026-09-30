/**
 * Targeted check (security): the encrypted prefs key is a function of the account (same PRF → same key on the web and
 * native derivation paths, and the same key via the 24-word vault path), blobs authenticate (tamper / other account →
 * nothing), and the chain nonce seam keeps per-address order without swallowing a policy refusal.
 */
import assert from "node:assert/strict";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { test } from "node:test";
import { openAccount, openAccountFromMnemonic, prfOutputToMnemonic } from "../src/derive.ts";
import { openPrefs, type Prefs, sealPrefs } from "../src/prefs.ts";
import { queuedNonces } from "../src/session/queue.ts";

const PRF_BYTES = 32;
const TTL = 900_000;
const IDLE = 60_000;
const SAMPLE: Prefs = { v: 1, session: { ttlMs: TTL, idleMs: IDLE, faceId: "every-trade" } };
const ADDRESS = "0x0000000000000000000000000000000000000001";

test("prefs key: same account on every path (web PBKDF2, native PBKDF2, vault phrase)", () => {
  const prf = new Uint8Array(randomBytes(PRF_BYTES));
  const phrase = prfOutputToMnemonic(prf);
  const web = openAccount(Uint8Array.from(prf));
  const native = openAccount(Uint8Array.from(prf), {
    pbkdf2: (p, s, r, l) => new Uint8Array(pbkdf2Sync(p, s, r, l, "sha512")),
  });
  const vault = openAccountFromMnemonic(phrase);
  assert.deepEqual(native.prefsKey, web.prefsKey);
  assert.deepEqual(vault.prefsKey, web.prefsKey);
  const blob = sealPrefs(web.prefsKey, SAMPLE);
  assert.deepEqual(openPrefs(vault.prefsKey, blob), SAMPLE);
  for (const o of [web, native, vault]) o.session.end();
});

test("prefs blobs authenticate: tampered or another account's blob reads as absent", () => {
  const a = openAccount(new Uint8Array(randomBytes(PRF_BYTES)));
  const b = openAccount(new Uint8Array(randomBytes(PRF_BYTES)));
  const blob = sealPrefs(a.prefsKey, SAMPLE);
  assert.equal(openPrefs(b.prefsKey, blob), undefined);
  const flipped = `${blob.slice(0, -2)}${blob.at(-2) === "A" ? "B" : "A"}${blob.at(-1)}`;
  assert.equal(openPrefs(a.prefsKey, flipped), undefined);
  assert.notEqual(sealPrefs(a.prefsKey, SAMPLE), blob, "fresh nonce per seal");
  a.session.end();
  b.session.end();
});

test("queuedNonces keeps per-address order and passes a policy refusal through without counting it", async () => {
  let next = 0;
  const inner = {
    async withNext<T>(_address: `0x${string}`, fn: (nonce: number) => Promise<T>) {
      const out = await fn(next);
      next += 1;
      return out;
    },
    resync() {},
  };
  const nonces = queuedNonces(inner);
  const seen: number[] = [];
  const refused = nonces.withNext(ADDRESS, async () => {
    throw new Error("OutOfScopeError");
  });
  const first = nonces.withNext(ADDRESS, async (n) => seen.push(n));
  const second = nonces.withNext(ADDRESS, async (n) => seen.push(n));
  await assert.rejects(refused, /OutOfScope/);
  await Promise.all([first, second]);
  assert.deepEqual(seen, [0, 1]);
});
