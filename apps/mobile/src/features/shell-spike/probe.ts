import { useSyncExternalStore } from "react";

/**
 * S1b.7 navigation spike (D-193): a self-running check of the headless-tabs shell on a real runtime. Each tab's list
 * registers how to scroll it and where a probe row sits on screen; the dock drives the sequence (scroll → push → switch
 * tabs → return) and records what came back. Results render on screen for the screenshot; nothing here ships.
 */
export type Verdict = "pending" | "pass" | "fail";

export interface ListHandle {
  scrollTo: (y: number) => void;
  scrollToEnd: () => void;
  /** Window y of the probe row's top edge. */
  probeRowY: () => Promise<number>;
  /** Window y of the last row's bottom edge. */
  lastRowBottom: () => Promise<number>;
}

export interface ProbeState {
  running: boolean;
  stack: Verdict;
  scrollHome: Verdict;
  scrollMarkets: Verdict;
  hideDuringEntry: Verdict;
  contentInset: Verdict;
  notes: readonly string[];
}

const INITIAL: ProbeState = {
  running: false,
  stack: "pending",
  scrollHome: "pending",
  scrollMarkets: "pending",
  hideDuringEntry: "pending",
  contentInset: "pending",
  notes: [],
};

let state: ProbeState = INITIAL;
const listeners = new Set<() => void>();
const lists = new Map<string, ListHandle>();

export function registerList(tab: string, handle: ListHandle): () => void {
  lists.set(tab, handle);
  return () => {
    if (lists.get(tab) === handle) lists.delete(tab);
  };
}

export function listFor(tab: string): ListHandle | undefined {
  return lists.get(tab);
}

export function updateProbe(patch: Partial<ProbeState>, note?: string) {
  state = { ...state, ...patch, notes: note ? [...state.notes, note] : state.notes };
  for (const listener of listeners) listener();
}

export function resetProbe() {
  state = { ...INITIAL, running: true };
  for (const listener of listeners) listener();
}

export function useProbe(): ProbeState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}
