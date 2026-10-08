/**
 * The one-tap delegate key on the web (D-280): memory only, like every web key (`secret-store.web.ts`). A reload ends
 * one-tap calls; the next call asks the passkey once and may grant a new session.
 */
import type { DelegateStore } from "./types.ts";

const memory = new Map<string, string>();

export const delegateStore: DelegateStore = {
  read: async (key) => memory.get(key) ?? null,
  write: async (key, value) => {
    memory.set(key, value);
  },
  remove: async (key) => {
    memory.delete(key);
  },
};
