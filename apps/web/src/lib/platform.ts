"use client";
/**
 * The platform's command key (R6.8): ⌘ on Apple devices, Ctrl elsewhere — in the triggers, the footer and the keyboard
 * map. The static HTML says ⌘ and the client corrects at once.
 */
import { useSyncExternalStore } from "react";

export function isApple(): boolean {
  if (typeof navigator === "undefined") return true;
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform;
  return /mac|iphone|ipad|ipod/i.test(platform) || /Mac OS X|iPhone|iPad/.test(navigator.userAgent);
}

const never = () => () => undefined;

/** "⌘" or "Ctrl". */
export function useModKey(): string {
  return useSyncExternalStore(
    never,
    () => (isApple() ? "⌘" : "Ctrl"),
    () => "⌘",
  );
}

/** "⌘K" or "Ctrl K"; "⌘↵" or "Ctrl ↵". */
export function useModCombo(key: string): string {
  const mod = useModKey();
  return mod === "⌘" ? `⌘${key}` : `Ctrl ${key}`;
}
