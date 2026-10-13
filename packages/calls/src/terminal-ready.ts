/**
 * What a link asked the terminal to have ready (D-340): a side lit on the trade buttons, a position's row open with
 * its Cash out ringed — for a few seconds, never placed or cashed out, and focus never moved (a held key can't carry
 * into a trade). Both apps' terminals read it.
 */
import { useSyncExternalStore } from "react";

export const READY_MS = 6_000;

export interface TerminalReady {
  side: "up" | "down" | null;
  /** A book key (`call:1019`). */
  position: string | null;
}

const NONE: TerminalReady = { side: null, position: null };
let ready: TerminalReady = NONE;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function setTerminalReady(next: Partial<TerminalReady>): void {
  ready = { side: next.side ?? null, position: next.position ?? null };
  clearTimeout(timer);
  timer = setTimeout(clearTerminalReady, READY_MS);
  emit();
}

export function clearTerminalReady(): void {
  if (ready === NONE) return;
  ready = NONE;
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const get = () => ready;

export function useTerminalReady(): TerminalReady {
  return useSyncExternalStore(subscribe, get, get);
}
