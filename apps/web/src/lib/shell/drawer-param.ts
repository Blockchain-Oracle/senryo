"use client";
/**
 * Drawers that live in the URL (D-190; Mitoshi `lib/drawer-param.ts`): `?d=<name>` opens one, so Back closes it, a
 * reload keeps it, and a link can open it. Writes go through `history.pushState` (Next keeps `useSearchParams` in step
 * with it), so opening a drawer never re-renders the route. Read inside a Suspense boundary.
 */
import { useSearchParams } from "next/navigation";

export const DRAWER_PARAM = "d";

/** Every drawer the app opens by name. */
export const DRAWERS = {
  everything: "everything",
  wallet: "wallet",
  receive: "receive",
  withdraw: "withdraw",
  settings: "settings",
  oneTap: "one-tap",
  call: "call",
} as const;

function urlWith(name: string | null, extra?: Record<string, string>): string {
  const url = new URL(window.location.href);
  if (name) url.searchParams.set(DRAWER_PARAM, name);
  else url.searchParams.delete(DRAWER_PARAM);
  for (const [k, v] of Object.entries(extra ?? {})) url.searchParams.set(k, v);
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Open a drawer by name from anywhere; `extra` adds its own params (a call's id). The entry is marked as ours so
 * `closeDrawer` can step back. Only our marker is passed: Next treats a state carrying its own internal flag as an
 * internal push and would not update `useSearchParams`.
 */
export function openDrawer(name: string, extra?: Record<string, string>): void {
  window.history.pushState({ __drawer: name }, "", urlWith(name, extra));
}

/** Close the open drawer: step back when we pushed it, else drop the param in place (it came with the page). */
export function closeDrawer(): void {
  const opened = new URLSearchParams(window.location.search).get(DRAWER_PARAM);
  if (!opened) return;
  if ((window.history.state as { __drawer?: string } | null)?.__drawer === opened) window.history.back();
  else window.history.replaceState(null, "", urlWith(null));
}

/** The drawer named in the URL. */
export function useDrawerParam(): string | null {
  return useSearchParams().get(DRAWER_PARAM);
}

/** Before a link inside a drawer navigates: drop the param in place, so Back from the new page doesn't reopen it. */
export function dropDrawerParam(): void {
  if (new URLSearchParams(window.location.search).has(DRAWER_PARAM))
    window.history.replaceState(null, "", urlWith(null));
}
