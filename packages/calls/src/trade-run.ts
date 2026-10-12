/**
 * The trade as one object from the tap to its result (R5.11, D-331; Codex direction 12 §1), for this session: an open
 * is drawn at the tap ("Signing…", what was quoted), waits for its fill ("Waiting for the fill", the request's digest),
 * and once booked its position row takes its place; a trade that ends — a call settled or cashed out, a ride closed,
 * knocked out, capped or ended — becomes its slip under "Just finished" until dismissed. The toast narrates; this
 * keeps the facts. A refusal or a failure removes the pending object (the toast says why).
 */
import { useSyncExternalStore } from "react";

export interface PendingTrade {
  /** The trade's toast id: a local key that holds from the tap. */
  key: string;
  instrument: "call" | "ride";
  symbol: string;
  /** "BTC · Up · 1m" / "BTC · Up · Ride". */
  title: string;
  /** What was quoted at the tap ("Stake $5.00", "Pays if right $6.08"); amounts are masked while balances are hidden. */
  quoted: readonly { k: string; v: string; money: boolean }[];
  stage: "signing" | "pending" | "booked";
  /** The relay's digest once sent ("Request 7AC19F42"). */
  digest: string | null;
  /** The ticket or ride once committed: its row replaces this object. */
  id: bigint | null;
  at: number;
}

export interface FinishedTrade {
  instrument: "call" | "ride";
  id: bigint;
  symbol: string;
  at: number;
}

interface RunState {
  pending: readonly PendingTrade[];
  finished: readonly FinishedTrade[];
  /** The trade that just ended, until dismissed or the next tap (the pill's place shows it, under 1024 px). */
  focused: FinishedTrade | null;
}

const MAX_FINISHED = 6;
/** A booked trade whose row hasn't arrived by now is let go (the book refreshes within seconds). */
const BOOKED_TTL_MS = 30_000;
let state: RunState = { pending: [], finished: [], focused: null };
const listeners = new Set<() => void>();

function set(next: RunState): void {
  state = next;
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function startRun(t: Omit<PendingTrade, "stage" | "digest" | "id" | "at">): void {
  set({
    ...state,
    pending: [{ ...t, stage: "signing", digest: null, id: null, at: Date.now() }, ...state.pending],
    focused: null,
  });
}

export function updateRun(key: string, patch: Partial<Pick<PendingTrade, "stage" | "digest" | "id">>): void {
  if (!state.pending.some((p) => p.key === key)) return;
  set({ ...state, pending: state.pending.map((p) => (p.key === key ? { ...p, ...patch } : p)) });
}

/** Cancelled, refused or failed: the toast says why; the object goes. */
export function dropRun(key: string): void {
  if (!state.pending.some((p) => p.key === key)) return;
  set({ ...state, pending: state.pending.filter((p) => p.key !== key) });
}

/** A trade of this session ended: its slip stays under "Just finished" (newest first) until dismissed. */
export function finishRun(t: Omit<FinishedTrade, "at">): void {
  const same = (x: { instrument: string; id: bigint | null }) => x.instrument === t.instrument && x.id === t.id;
  const done = { ...t, at: Date.now() };
  set({
    pending: state.pending.filter((p) => !same(p)),
    finished: [done, ...state.finished.filter((f) => !same(f))].slice(0, MAX_FINISHED),
    focused: done,
  });
}

export function dismissFinished(t: Pick<FinishedTrade, "instrument" | "id">): void {
  const same = (f: FinishedTrade | null) => f !== null && f.instrument === t.instrument && f.id === t.id;
  set({
    ...state,
    finished: state.finished.filter((f) => !same(f)),
    focused: same(state.focused) ? null : state.focused,
  });
}

/**
 * This session's trades on their way and just finished. A pending trade whose ticket or ride is already in `held` (the
 * live book) is left out: its row has taken its place.
 */
export function useTradeRuns(held: (instrument: "call" | "ride", id: bigint) => boolean): RunState {
  const s = useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
  const now = Date.now();
  return {
    pending: s.pending.filter((p) => p.id === null || (!held(p.instrument, p.id) && now - p.at < BOOKED_TTL_MS)),
    finished: s.finished,
    focused: s.focused,
  };
}
