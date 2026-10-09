"use client";
/**
 * The terminal's remembered choices on this device (the phone keeps them in MMKV): the lane, the last stake and the
 * way to call. Read
 * through `useSyncExternalStore`; the static HTML uses the defaults and the client corrects at once.
 */
import { useCallback, useSyncExternalStore } from "react";

export const TERMINAL_STORAGE = {
  cadence: "senryo.terminal.cadence.v1",
  stake: "senryo.terminal.stake.v1",
  mode: "senryo.terminal.mode.v1",
} as const;

const listeners = new Set<() => void>();
/** This page's choices, so a blocked storage still remembers them until reload. */
const memory = new Map<string, string>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function read(key: string): string | null {
  const held = memory.get(key);
  if (held !== undefined) return held;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useStoredString(key: string): [string | null, (next: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  const set = useCallback(
    (next: string) => {
      memory.set(key, next);
      try {
        localStorage.setItem(key, next);
      } catch {
        // `memory` holds it until reload.
      }
      for (const l of listeners) l();
    },
    [key],
  );
  return [value, set];
}
