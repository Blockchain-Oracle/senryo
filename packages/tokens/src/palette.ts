/**
 * "Living Lacquer" palette (D-168, docs/design/senryo-v2/direction.md §2; v2-plan §5.2): the single source of colour for
 * web and mobile. Dark is the default; the first dark tokens follow the study's sampled Fomo colours, the light theme is a
 * declared adaptation. Roles the direction leaves implicit (secondary, muted, accent, ring, chart series) are Codex's
 * values from the S1b.6 consult (D-191). The role names are the shadcn/Tailwind ones the web already maps.
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
  | "chartCandleDown"
  /** Mode identity (D-172): practice = violet, mainnet = blue — never gold. */
  | "practice"
  | "mainnet";

export type Palette = Readonly<Record<ColorRole, string>>;

/** Dark is the default. Background · raised (`card`) · sheet (`popover`); Text 1 / Text 2 (`mutedForeground`). */
export const DARK: Palette = {
  background: "#0A0911",
  foreground: "#F5F4FA",
  card: "#13121A",
  cardForeground: "#F5F4FA",
  popover: "#191822",
  popoverForeground: "#F5F4FA",
  primary: "#414EF4",
  primaryForeground: "#FFFFFF",
  secondary: "#201E2B",
  secondaryForeground: "#F5F4FA",
  muted: "#201E2B",
  mutedForeground: "#B8B5C4",
  accent: "#1B2040",
  accentForeground: "#8B95FF",
  destructive: "#FF5A48",
  destructiveForeground: "#17151F",
  border: "#2C2938",
  input: "#2C2938",
  ring: "#8B95FF",
  surface: "#13121A",
  up: "#25CF68",
  down: "#FF5A48",
  gold: "#D4AE5B",
  warn: "#F2B85C",
  chart1: "#8B95FF",
  chart2: "#B69DF8",
  chart3: "#5CCAD8",
  chart4: "#F18BB7",
  chart5: "#C9D0DD",
  chartUp: "#25CF68",
  chartDown: "#FF5A48",
  chartCandleDown: "#FF5A48",
  practice: "#B69DF8",
  mainnet: "#8B95FF",
};

/** Light theme (declared adaptation, direction §2). */
export const LIGHT: Palette = {
  background: "#F5F4F8",
  foreground: "#17151F",
  card: "#FFFFFF",
  cardForeground: "#17151F",
  popover: "#FFFFFF",
  popoverForeground: "#17151F",
  primary: "#414EF4",
  primaryForeground: "#FFFFFF",
  secondary: "#ECE9F2",
  secondaryForeground: "#17151F",
  muted: "#ECE9F2",
  mutedForeground: "#5F5B6B",
  accent: "#E8EBFF",
  accentForeground: "#3643D8",
  destructive: "#C83225",
  destructiveForeground: "#FFFFFF",
  border: "#DEDBE6",
  input: "#DEDBE6",
  ring: "#3643D8",
  surface: "#FFFFFF",
  up: "#087F3C",
  down: "#C83225",
  gold: "#89611F",
  warn: "#8A5800",
  chart1: "#3643D8",
  chart2: "#7049C8",
  chart3: "#087A8A",
  chart4: "#AD3265",
  chart5: "#626D7E",
  chartUp: "#087F3C",
  chartDown: "#C83225",
  chartCandleDown: "#C83225",
  practice: "#7049C8",
  mainnet: "#3643D8",
};

export const PALETTES = { dark: DARK, light: LIGHT } as const;
export type ThemeName = keyof typeof PALETTES;
export const DEFAULT_THEME: ThemeName = "dark";
