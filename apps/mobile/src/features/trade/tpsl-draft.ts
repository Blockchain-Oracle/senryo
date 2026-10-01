/**
 * The TP/SL child's typed levels, kept outside React and keyed by chain, account and market (like the traces in
 * `@senryo/query`). Closing the child, or a remount, keeps what was typed and which levels the last save attempted, so
 * a level whose transaction didn't land is still there to retry and its outcome note still describes it (R01, R06).
 * A save that finishes after the child closed clears only the level that finalized.
 */
import { useCallback, useSyncExternalStore } from "react";
import type { TriggerKind } from "./tpsl";

export interface TriggerField {
  price: string;
  percent: string;
}

export interface TriggerDraft {
  fields: Readonly<Record<TriggerKind, TriggerField>>;
  /** The levels the last save tried, in order; the "all saved" line needs every one of them finalized. */
  attempted: readonly TriggerKind[];
}

export const EMPTY_FIELD: TriggerField = { price: "", percent: "" };
const BLANK: TriggerDraft = { fields: { sl: EMPTY_FIELD, tp: EMPTY_FIELD }, attempted: [] };

const drafts = new Map<string, TriggerDraft>();
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

export type DraftUpdate = (update: (prev: TriggerDraft) => TriggerDraft) => void;

export function useTriggerDraft(key: string): [TriggerDraft, DraftUpdate] {
  const draft = useSyncExternalStore(
    (listener) => subscribe(key, listener),
    () => drafts.get(key) ?? BLANK,
    () => drafts.get(key) ?? BLANK,
  );
  const update = useCallback<DraftUpdate>(
    (change) => {
      drafts.set(key, change(drafts.get(key) ?? BLANK));
      for (const listener of listeners.get(key) ?? []) listener();
    },
    [key],
  );
  return [draft, update];
}
