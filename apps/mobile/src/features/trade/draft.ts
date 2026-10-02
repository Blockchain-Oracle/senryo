/**
 * The ticket's draft (side, keypad text, leverage) lives outside React, keyed by (chain, market), so it survives
 * remounts, child sheets and tab switches — a stale→fresh reading once remounted the Ticket and wiped the amount mid-entry
 * (phone test, S8.16a). Session-scoped only: nothing money-bearing is persisted.
 */
import { useCallback, useSyncExternalStore } from "react";

export type Side = "long" | "short";

export interface TicketDraft {
  side: Side;
  amountText: string;
  leverage: number;
}

const drafts = new Map<string, TicketDraft>();
const listeners = new Map<string, Set<() => void>>();

function subscribe(key: string, listener: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

export function draftKey(chainId: number, marketId: number, address: string = "guest"): string {
  return `trade:${chainId}:${address.toLowerCase()}:${marketId}`;
}

/** The draft for one ticket, created from `initial` on first use; `update` merges and notifies every mounted reader. */
export function useTicketDraft(key: string, initial: TicketDraft) {
  if (!drafts.has(key)) drafts.set(key, initial);
  const draft = useSyncExternalStore(
    (listener) => subscribe(key, listener),
    () => drafts.get(key) ?? initial,
    () => drafts.get(key) ?? initial,
  );
  const update = useCallback(
    (patch: Partial<TicketDraft> | ((prev: TicketDraft) => Partial<TicketDraft>)) => {
      const prev = drafts.get(key) ?? initial;
      const next = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
      drafts.set(key, next);
      for (const listener of listeners.get(key) ?? []) listener();
    },
    [key, initial],
  );
  return { draft, update };
}
