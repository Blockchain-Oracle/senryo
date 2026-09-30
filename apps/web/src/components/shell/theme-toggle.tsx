"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Dark ⇄ paper. Renders a stable icon until hydrated so the static HTML never mismatches. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const light = hydrated && resolvedTheme === "light";
  return (
    <button
      type="button"
      onClick={() => setTheme(light ? "dark" : "light")}
      aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
      className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-(--motion-fast) ease-desk hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
    >
      {light ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  );
}
