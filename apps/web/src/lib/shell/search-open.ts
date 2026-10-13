"use client";
/**
 * Whether search is open (R6): the top line's trigger, the terminal's, Everything's search row, ⌘K / Ctrl+K and `/`
 * all open the same palette. `null` until first asked — the palette is a lazy island loaded then.
 */
import { useSyncExternalStore } from "react";

let open: boolean | null = null;
const listeners = new Set<() => void>();

function set(next: boolean): void {
  if (open === next) return;
  open = next;
  for (const l of listeners) l();
}

export const openSearch = (): void => set(true);
export const closeSearch = (): void => set(false);
export const toggleSearch = (): void => set(!open);
export const setSearchOpen = (next: boolean): void => set(next);

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useSearchOpen(): boolean | null {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => null,
  );
}
