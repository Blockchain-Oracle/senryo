"use client";
/**
 * The terminal's remembered choices on this device (the phone keeps them in MMKV): the lane, the last stake, the way to
 * call, Call or Ride with the ride's margin, leverage and trail (R5.4), the call's trail, and the market picker's starred
 * markets (P2; recent markets are the device's visits, D-337). Read through `useSyncExternalStore`; the static HTML
 * uses the defaults and the client corrects at once.
 */
import { useCallback, useSyncExternalStore } from "react";

export const TERMINAL_STORAGE = {
  cadence: "senryo.terminal.cadence.v1",
  stake: "senryo.terminal.stake.v1",
  mode: "senryo.terminal.mode.v1",
  instrument: "senryo.terminal.instrument.v1",
  rideMargin: "senryo.terminal.ride-margin.v1",
  /** v2 (D-344): leverage is opt-in, so every device starts at no leverage; the multiple last used when on. */
  leverage: "senryo.terminal.leverage.v2",
  leverageOn: "senryo.terminal.leverage-on.v1",
  rideTrail: "senryo.terminal.ride-trail.v1",
  callTrail: "senryo.terminal.call-trail.v1",
  favourites: "senryo.favourite-markets.v1",
  /** The chart's view, line or candles, and the candles' interval (R5.17). */
  chart: "senryo.terminal.chart.v1",
  candleInterval: "senryo.terminal.candle-interval.v1",
  /** The terminal's tour was seen on this device (R5.15). */
  tour: "senryo.terminal.tour.v1",
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
