/**
 * Targeted check (security, D-255): a native step-up is one fresh Face ID read of the gated unlock item, and only for
 * the hinted account. A missing, invalidated or foreign item falls through to the pinned passkey ceremony; nothing
 * else ever yields the one-shot signer.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { WebAuthnClient } from "@category-labs/mera";
import { AccountClient } from "../src/client.ts";
import { PRF_OUTPUT_BYTES } from "../src/constants.ts";
import { openAccount } from "../src/derive.ts";
import type { AccountHint, SecretStore, UnlockRead } from "../src/platform/types.ts";

const MINE = 7;
const OTHER = 9;
const prf = (fill: number) => new Uint8Array(PRF_OUTPUT_BYTES).fill(fill);
const CEREMONY = new Error("passkey ceremony reached");
/** base64url("credential"): Mera decodes the pinned id before the ceremony. */
const CREDENTIAL_ID = "Y3JlZGVudGlhbA";

/** The ceremony was reached when its sentinel is anywhere in the cause chain (Mera and AuthError wrap it). */
function reachedCeremony(error: unknown): boolean {
  for (let e = error; e instanceof Error; e = e.cause) if (e === CEREMONY) return true;
  return false;
}

function addressOf(fill: number) {
  const opened = openAccount(prf(fill));
  opened.session.end();
  return opened.address;
}

function harness(read: () => UnlockRead) {
  const prompts: string[] = [];
  const hint: AccountHint = {
    address: addressOf(MINE),
    credential: { credentialId: CREDENTIAL_ID },
    mode: "passkey",
    savedAt: 0,
  };
  const store: SecretStore = {
    kind: "native",
    readHint: async () => hint,
    writeHint: async () => {},
    canPersistUnlock: async () => true,
    storeUnlock: async () => {},
    readUnlock: async (prompt) => {
      prompts.push(prompt);
      return read();
    },
    clear: async () => {},
  };
  const webAuthnClient: WebAuthnClient = {
    createCredential: async () => {
      throw CEREMONY;
    },
    getCredential: async () => {
      throw CEREMONY;
    },
  };
  const client = new AccountClient({ rpId: "senryo.xyz", passkey: { kind: "native", webAuthnClient }, store });
  return { client, hint, prompts };
}

test("step-up signs with the Face ID item when it opens the hinted account (no passkey sheet)", async () => {
  const { client, hint, prompts } = harness(() => ({
    status: "ok",
    credentialId: CREDENTIAL_ID,
    prfOutput: prf(MINE),
  }));
  await client.load();
  const signed = await client.stepUp(async (signer) => signer.address, "Approve with Face ID");
  assert.equal(signed, hint.address);
  assert.deepEqual(prompts, ["Approve with Face ID"]);
});

test("a Face ID item from another account never signs: the pinned ceremony runs instead", async () => {
  const { client } = harness(() => ({ status: "ok", credentialId: CREDENTIAL_ID, prfOutput: prf(OTHER) }));
  await client.load();
  await assert.rejects(
    client.stepUp(async () => assert.fail("must not sign")),
    reachedCeremony,
  );
});

for (const status of ["absent", "invalidated"] as const) {
  test(`an ${status} Face ID item falls back to the passkey ceremony`, async () => {
    const { client } = harness(() => ({ status }));
    await client.load();
    await assert.rejects(
      client.stepUp(async () => assert.fail("must not sign")),
      reachedCeremony,
    );
  });
}
