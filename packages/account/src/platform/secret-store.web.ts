/**
 * Web store: the non-secret hint only (localStorage). The PRF output is never persisted on web (Mera web demo; spec
 * client.md) — after a reload the account is LOCKED and the next signing action runs one passkey ceremony.
 */
import { STORAGE } from "../constants.ts";
import { decodeHint, encodeHint } from "./hint.ts";
import type { AccountHint, SecretStore, UnlockRead } from "./types.ts";

function storage(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    // Some privacy modes throw on access; the app then simply behaves as a fresh device.
    return undefined;
  }
}

export const secretStore: SecretStore = {
  kind: "web",
  async readHint(): Promise<AccountHint | undefined> {
    const s = storage();
    const hint = decodeHint(s?.getItem(STORAGE.hint));
    if (s && hint === undefined) s.removeItem(STORAGE.hint);
    return hint;
  },
  async writeHint(hint: AccountHint): Promise<void> {
    storage()?.setItem(STORAGE.hint, encodeHint(hint));
  },
  async canPersistUnlock(): Promise<boolean> {
    return false;
  },
  async storeUnlock(): Promise<void> {
    // Intentionally nothing: web never keeps key material between page loads.
  },
  async readUnlock(): Promise<UnlockRead> {
    return { status: "absent" };
  },
  async clear(): Promise<void> {
    storage()?.removeItem(STORAGE.hint);
  },
};
