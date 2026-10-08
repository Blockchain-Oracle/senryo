/**
 * The one-tap delegate key on the phone (D-280): ungated, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, never synced or backed up.
 * It is not the account key — the chain caps what it can do (per call, per session, until expiry; a revoke kills it) —
 * so it survives app restarts inside its session without a Face ID per call. The account key stays in the gated item.
 */
import * as SecureStore from "expo-secure-store";
import type { DelegateStore } from "./types.ts";

const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export const delegateStore: DelegateStore = {
  async read(key) {
    try {
      return await SecureStore.getItemAsync(key, OPTIONS);
    } catch {
      return null;
    }
  },
  write: (key, value) => SecureStore.setItemAsync(key, value, OPTIONS),
  remove: (key) => SecureStore.deleteItemAsync(key, OPTIONS),
};
