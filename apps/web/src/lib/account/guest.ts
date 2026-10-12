"use client";
/**
 * The Practice guest on the web (R5.10, `@senryo/calls` `guest.ts`): its key in the browser's store, so a reload keeps
 * the guest's test dollars and open calls (Practice only — it never holds real money), and its SIWE session on the
 * app's api client. `useAppTrader` is who trades here: the passkey account, else the guest once it has started.
 */
import type { LocalAccount } from "@senryo/account";
import { configureGuestStore } from "@senryo/calls";
import { type Trader, useTrader } from "@senryo/calls/react";
import type { SessionRunner } from "@senryo/query";
import { withKeySession } from "./api";
import { kvStore, removeKey } from "./local";
import { useAccount } from "./provider";

configureGuestStore({
  read: async (key) => kvStore.getItem(key),
  write: async (key, value) => kvStore.setItem(key, value),
  remove: async (key) => removeKey(key),
});

export const guestSession =
  (key: LocalAccount): SessionRunner =>
  (run) =>
    withKeySession(key, run);

export function useAppTrader(): Trader {
  return useTrader(useAccount());
}
