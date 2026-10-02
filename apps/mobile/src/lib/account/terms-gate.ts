/**
 * The terms gate (A11, defect 6): before an account's first money action — trade, add money, send, withdraw, swap,
 * pool, card — the terms sheet rises over the screen once; agreeing records the terms version for the address on this
 * phone and the action carries on, backing out leaves it untouched. A guest gets the account sheet instead, carrying
 * the action so it resumes after the account exists. Screens call `useTermsGate()` and wrap the action:
 *
 *   const gate = useTermsGate();
 *   onPress={() => gate(() => router.push(ticketRoute(market, side)), { verb: "trade", next: ticketRoute(market, side) })}
 */
import { type Href, router } from "expo-router";
import { useCallback, useSyncExternalStore } from "react";
import { hasAcknowledgedTerms } from "~/features/legal/acknowledged";
import { type AccountVerb, accountRequiredRoute, ROUTES } from "~/lib/constants/routes";
import { useAccount } from "./provider";

interface TermsRequest {
  settle: (agreed: boolean) => void;
}

let current: TermsRequest | undefined;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

/** Raise the terms sheet; resolves true once agreed, false when it is dismissed. */
export function requestTerms(): Promise<boolean> {
  current?.settle(false);
  return new Promise<boolean>((resolve) => {
    current = {
      settle: (agreed) => {
        current = undefined;
        emit();
        resolve(agreed);
      },
    };
    emit();
    router.push(ROUTES.termsSheet);
  });
}

export function useTermsRequest(): TermsRequest | undefined {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => undefined,
  );
}

export interface GateIntent {
  /** What the guest sheet says: "Create an account to {verb}". */
  verb: AccountVerb;
  /** The in-app path that re-opens the action after the account exists (a guest only). */
  next?: string;
}

/**
 * `gate(run, intent)`: runs `run` at once when this phone's account agreed to the current terms; otherwise raises the
 * terms sheet first (a guest: the account sheet). Never runs `run` twice and never without the agreement.
 */
export function useTermsGate(): (run: () => void, intent: GateIntent) => void {
  const account = useAccount();
  const address = account.hint?.address;
  const ready = account.ready;
  return useCallback(
    (run, intent) => {
      if (!ready) return;
      if (!address) {
        router.push(accountRequiredRoute(intent.verb, intent.next) as Href);
        return;
      }
      if (hasAcknowledgedTerms(address)) {
        run();
        return;
      }
      void requestTerms().then((agreed) => {
        if (agreed) run();
      });
    },
    [address, ready],
  );
}
