import { DARK, LIGHT } from "@senryo/tokens";
import type { Scheme } from "../registry.ts";
import type { IdentityTheme } from "../theme.ts";

/**
 * EntityMark's colours on the web: theme-aware roles are the app's CSS variables (tokens.css), so a theme switch
 * restyles marks without a re-render; the fixed light/dark plates come from the token palettes.
 */
export function webIdentityTheme(scheme: Scheme): IdentityTheme {
  return {
    scheme,
    plate: "var(--secondary)",
    rim: "var(--border)",
    plateLight: LIGHT.card,
    plateDark: DARK.card,
    ground: "var(--card)",
    skeleton: "var(--muted)",
    fallbackInk: "var(--muted-foreground)",
  };
}
