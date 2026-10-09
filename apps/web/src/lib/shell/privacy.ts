"use client";
/**
 * Hide balances (the phone's `lib/hide-balances.ts`; Slush's balance eye): one tap hides every balance and result on
 * this device until tapped again. Persisted in localStorage, read through `useSyncExternalStore` so every figure flips
 * in the same frame.
 */
import { useSyncExternalStore } from "react";
import { STORAGE } from "@/lib/feedback/constants";

const listeners = new Set<() => void>();
let hidden: boolean | null = null;

function read(): boolean {
  if (hidden === null) {
    try {
      hidden = localStorage.getItem(STORAGE.privacy) === "1";
    } catch {
      hidden = false;
    }
  }
  return hidden;
}

export function setPrivacy(next: boolean): void {
  hidden = next;
  try {
    localStorage.setItem(STORAGE.privacy, next ? "1" : "0");
  } catch {
    // Storage unavailable: the choice holds for this page.
  }
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** True while balances are hidden. The static HTML shows them; the client corrects at once. */
export function usePrivacy(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

/** The mask shown in place of a hidden amount. */
export const HIDDEN_AMOUNT = "••••";

export function masked(text: string, hide: boolean): string {
  return hide ? HIDDEN_AMOUNT : text;
}
