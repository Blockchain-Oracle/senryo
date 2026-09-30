/**
 * Native store (expo-secure-store), the Mera mobile-demo pattern (demos/mobile/src/storage.ts):
 *  - hint: ungated, `WHEN_UNLOCKED_THIS_DEVICE_ONLY` — launch renders the portfolio with no prompt;
 *  - unlock: the PRF output behind `requireAuthentication` (iOS biometryCurrentSet / Android BiometricPrompt),
 *    `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. Reading it shows the OS biometric sheet, not the passkey sheet (D-028).
 * This is the one sanctioned place key material is persisted (spec flows.md F01, D-028); web never persists it. The
 * OS invalidates the gated item when biometrics change; `getItemAsync` then resolves null,
 * which the ungated marker lets us tell apart from "never stored".
 */
import { base64urlnopad } from "@scure/base";
import * as SecureStore from "expo-secure-store";
import { PRF_OUTPUT_BYTES, STORAGE } from "../constants.ts";
import { AuthError } from "../errors.ts";
import { decodeHint, encodeHint } from "./hint.ts";
import type { AccountHint, SecretStore, UnlockRead } from "./types.ts";

const UNGATED: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const gated = (prompt: string): SecureStore.SecureStoreOptions => ({
  requireAuthentication: true,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  authenticationPrompt: prompt,
});
/** Ungated marker: "a gated unlock item was written" — so a null read means invalidated, not absent. */
const MARKER = `${STORAGE.unlock}.present`;
const SAVE_PROMPT = "Save Face ID unlock";
const CANCEL = /cancel/i;

interface StoredUnlock {
  credentialId: string;
  secret: string;
}

export const secretStore: SecretStore = {
  kind: "native",
  async readHint(): Promise<AccountHint | undefined> {
    let raw: string | null;
    try {
      raw = await SecureStore.getItemAsync(STORAGE.hint, UNGATED);
    } catch {
      // Keychain unavailable (e.g. an unsigned simulator build, errSecMissingEntitlement): a missing hint is the
      // normal path (stateless test) — the app stays usable and "I already have an account" rebuilds everything.
      return undefined;
    }
    const hint = decodeHint(raw);
    if (raw !== null && hint === undefined) await SecureStore.deleteItemAsync(STORAGE.hint, UNGATED).catch(() => {});
    return hint;
  },
  async writeHint(hint: AccountHint): Promise<void> {
    await SecureStore.setItemAsync(STORAGE.hint, encodeHint(hint), UNGATED);
  },
  async canPersistUnlock(): Promise<boolean> {
    return SecureStore.canUseBiometricAuthentication();
  },
  async storeUnlock(credentialId: string, prfOutput: Uint8Array): Promise<void> {
    const value: StoredUnlock = { credentialId, secret: base64urlnopad.encode(prfOutput) };
    // Android authenticates writes too (expo docs): this is the one extra biometric prompt at sign-up there.
    await SecureStore.setItemAsync(STORAGE.unlock, JSON.stringify(value), gated(SAVE_PROMPT));
    await SecureStore.setItemAsync(MARKER, "1", UNGATED);
  },
  async readUnlock(prompt: string): Promise<UnlockRead> {
    let raw: string | null;
    try {
      raw = await SecureStore.getItemAsync(STORAGE.unlock, gated(prompt));
    } catch (error) {
      throw new AuthError(error instanceof Error && CANCEL.test(error.message) ? "cancelled" : "unknown", {
        cause: error,
      });
    }
    if (raw === null) {
      const marked = (await SecureStore.getItemAsync(MARKER, UNGATED)) !== null;
      return marked ? { status: "invalidated" } : { status: "absent" };
    }
    const parsed = JSON.parse(raw) as Partial<StoredUnlock>;
    if (typeof parsed.credentialId !== "string" || typeof parsed.secret !== "string") return { status: "invalidated" };
    const bytes = Uint8Array.from(base64urlnopad.decode(parsed.secret));
    if (bytes.length !== PRF_OUTPUT_BYTES) return { status: "invalidated" };
    return { status: "ok", credentialId: parsed.credentialId, prfOutput: bytes };
  },
  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(STORAGE.unlock);
    await SecureStore.deleteItemAsync(MARKER, UNGATED);
    await SecureStore.deleteItemAsync(STORAGE.hint, UNGATED);
  },
};
