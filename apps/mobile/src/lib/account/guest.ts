/**
 * The Practice guest on the phone (R5.10, `@senryo/calls` `guest.ts`): its key in the one-tap delegate's store
 * (SecureStore, this device only, never backed up — Practice only, it never holds real money) and its SIWE session on
 * the app's api client. `useAppTrader` is who trades here: the passkey account, else the guest once it has started.
 */
import type { LocalAccount } from "@senryo/account";
import { delegateStore } from "@senryo/account/delegate-store";
import { configureGuestStore } from "@senryo/calls";
import { type Trader, useTrader } from "@senryo/calls/react";
import type { SessionRunner } from "@senryo/query";
import { withKeySession } from "./api";
import { useAccount } from "./provider";

configureGuestStore(delegateStore);

export const guestSession =
  (key: LocalAccount): SessionRunner =>
  (run) =>
    withKeySession(key, run);

export function useAppTrader(): Trader {
  return useTrader(useAccount());
}
