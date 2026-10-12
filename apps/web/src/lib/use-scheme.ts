"use client";
/**
 * The theme to draw with, safe to branch markup on. The static export renders before any theme is known, so the HTML
 * is light (D-304's default); next-themes reads the saved choice on the very first client render, so markup that
 * branched on `resolvedTheme` (a mark's plate or variant, a crest's dark file) hydrated differently in the dark theme.
 * `useScheme` answers light while React hydrates — matching the HTML — and the saved theme from the next render on.
 */
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False while React hydrates the static HTML, true from the first client-only render. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

export function useScheme(): "light" | "dark" {
  const { resolvedTheme } = useTheme();
  return useHydrated() && resolvedTheme === "dark" ? "dark" : "light";
}
