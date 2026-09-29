/**
 * D2 Desk palette (D-004) — the single source of colour for web and mobile.
 * Values come from the approved preview (`design/preview/app/directions.css`, `.theme-d2` / `.theme-d2.light`),
 * plus the three tokens the 21st Candle Chart expects but the preview never defined
 * (`chartUp`, `chartCandleDown`, `surface` — see docs/plan/specs/client.md).
 */

export type ColorRole =
  | "background"
  | "foreground"
  | "card"
  | "cardForeground"
  | "popover"
  | "popoverForeground"
  | "primary"
  | "primaryForeground"
  | "secondary"
  | "secondaryForeground"
  | "muted"
  | "mutedForeground"
  | "accent"
  | "accentForeground"
  | "destructive"
  | "destructiveForeground"
  | "border"
  | "input"
  | "ring"
  | "surface"
  | "up"
  | "down"
  | "gold"
  | "warn"
  | "chart1"
  | "chart2"
  | "chart3"
  | "chart4"
  | "chart5"
  | "chartUp"
  | "chartDown"
  | "chartCandleDown";

export type Palette = Readonly<Record<ColorRole, string>>;

/** Dark is the default D2 look. */
export const DARK: Palette = {
  background: "#000000",
  foreground: "#f5f5f5",
  card: "#0c0c0d",
  cardForeground: "#f5f5f5",
  popover: "#111113",
  popoverForeground: "#ffffff",
  primary: "#2fe92b",
  primaryForeground: "#000000",
  secondary: "#1b1b1d",
  secondaryForeground: "#ffffff",
  muted: "#141416",
  mutedForeground: "#8a8a93",
  accent: "#1b1b1d",
  accentForeground: "#fbfb0f",
  destructive: "#ff5102",
  destructiveForeground: "#000000",
  border: "#26272d",
  input: "#26272d",
  ring: "#2fe92b",
  surface: "#0c0c0d",
  up: "#2fe92b",
  down: "#ff4d4d",
  gold: "#fbfb0f",
  warn: "#fbfb0f",
  chart1: "#fbfb0f",
  chart2: "#2fe92b",
  chart3: "#ff9821",
  chart4: "#cfd919",
  chart5: "#7c7cff",
  chartUp: "#2fe92b",
  chartDown: "#ff4d4d",
  chartCandleDown: "#ff4d4d",
};

/** Light alternate from the preview; roles the preview left unset inherit sensible light values. */
export const LIGHT: Palette = {
  background: "#f4f4f2",
  foreground: "#0a0a0a",
  card: "#ffffff",
  cardForeground: "#0a0a0a",
  popover: "#ffffff",
  popoverForeground: "#0a0a0a",
  primary: "#0a0a0a",
  primaryForeground: "#2fe92b",
  secondary: "#e9e9e6",
  secondaryForeground: "#0a0a0a",
  muted: "#ececea",
  mutedForeground: "#62626b",
  accent: "#e9e9e6",
  accentForeground: "#0a0a0a",
  destructive: "#ff5102",
  destructiveForeground: "#000000",
  border: "#dcdcd8",
  input: "#dcdcd8",
  ring: "#0f9d0c",
  surface: "#ffffff",
  up: "#0f9d0c",
  down: "#e0301e",
  gold: "#b88a00",
  warn: "#b88a00",
  chart1: "#0a0a0a",
  chart2: "#0f9d0c",
  chart3: "#c46a00",
  chart4: "#8a9400",
  chart5: "#4b4bd6",
  chartUp: "#0f9d0c",
  chartDown: "#e0301e",
  chartCandleDown: "#e0301e",
};

export const PALETTES = { dark: DARK, light: LIGHT } as const;
export type ThemeName = keyof typeof PALETTES;
export const DEFAULT_THEME: ThemeName = "dark";
