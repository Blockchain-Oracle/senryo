"use client";
/**
 * When the terminal's tour shows (R5.15): once on the first terminal visit on this device, and whenever Settings asks
 * for it. The host (`TourHost`) reads it; the flag is remembered with the terminal's other choices.
 */
import { useSyncExternalStore } from "react";
import { TERMINAL_STORAGE, useStoredString } from "./stored";

let open = false;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const set = (next: boolean) => {
  open = next;
  for (const l of listeners) l();
};

export const openTour = (): void => set(true);
export const closeTour = (): void => set(false);

export function useTourOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
}

/** [seen, markSeen]: the first terminal visit opens the tour while this is false. */
export function useTourSeen(): [boolean, () => void] {
  const [value, setValue] = useStoredString(TERMINAL_STORAGE.tour);
  return [value === "seen", () => setValue("seen")];
}
