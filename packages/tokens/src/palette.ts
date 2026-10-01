/**
 * "Living Lacquer" palette (D-168, docs/design/senryo-v2/direction.md §2; v2-plan §5.2): the single source of colour for
 * web and mobile. Dark is the default; the first dark tokens follow the study's sampled Fomo colours, the light theme is a
 * declared adaptation. Roles the direction leaves implicit (secondary, muted, accent, ring, chart series, pressed and
 * surface states) are Codex's values from the S1b.6 consult (docs/design/senryo-v2/tokens-consult.md, D-191).
 * The first block keeps the shadcn/Tailwind names the web already maps; the second block is the Living Lacquer roles.
 * Eight-digit values are `#RRGGBBAA`.
 */

type ShadcnRole =
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

type LacquerRole =
  /** Text 2 (= mutedForeground) and Text 3 (tertiary metadata; light fixed to ≥ 4.5:1, D-191). */
  | "text2"
  | "text3"
  | "link"
  /** Dock material: tint over live blur, decorative rim, and the opaque reduced-transparency equivalent. */
  | "glassTint"
  | "glassRim"
  | "glassOpaque"
  /** Phantom fan: discs, the ink inside them, labels left of them, pressed disc, opaque backdrop for reduced transparency. */
  | "fanCircle"
  | "fanText"
  | "fanLabel"
  | "fanCirclePressed"
  | "fanBackdropOpaque"
  /** Ordinary sheets dim; the fan tints over its live blur. */
  | "sheetScrim"
  | "fanScrim"
  /** Opaque status plates (ink: warn / practice / mainnet / up / down). */
  | "warningSurface"
  | "practiceSurface"
  | "mainnetSurface"
  | "upSurface"
  | "downSurface"
  | "destructiveSurface"
  /** Silver UI accent (gold UI is `gold`). */
  | "silver"
  /** Neutral elevated/control fill, pressed and selected rows, loading geometry. */
  | "raised2"
  | "rowPressed"
  | "selectedRow"
  | "skeleton"
  | "primaryPressed"
  /** Ink on solid up/down action fills. */
  | "upForeground"
  | "downForeground"
  | "chartNeutral"
  | "sheetHandle";

export type ColorRole = ShadcnRole | LacquerRole;
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

  text2: "#B8B5C4",
  text3: "#8F8B9F",
  link: "#8B95FF",
  glassTint: "#201E2BD9",
  glassRim: "#FFFFFF24",
  glassOpaque: "#201E2B",
  fanCircle: "#C3B5F6",
  fanText: "#211A31",
  fanLabel: "#F5F4FA",
  fanCirclePressed: "#AE9BE8",
  fanBackdropOpaque: "#191822",
  sheetScrim: "#00000066",
  fanScrim: "#0A091180",
  warningSurface: "#332719",
  practiceSurface: "#282038",
  mainnetSurface: "#1B2040",
  upSurface: "#102A1C",
  downSurface: "#35201F",
  destructiveSurface: "#35201F",
  silver: "#C9D0DD",
  raised2: "#201E2B",
  rowPressed: "#2C2938",
  selectedRow: "#1B2040",
  skeleton: "#2C2938",
  primaryPressed: "#343ED3",
  upForeground: "#17151F",
  downForeground: "#17151F",
  chartNeutral: "#8F8B9F",
  sheetHandle: "#8F8B9F",
};

/** Light theme (declared adaptation, direction §2). Text 3 #746F82 → #716C7F: 4.62:1 on #F5F4F8 (D-191). */
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

  text2: "#5F5B6B",
  text3: "#716C7F",
  link: "#3643D8",
  glassTint: "#FFFFFFD9",
  glassRim: "#FFFFFFB3",
  glassOpaque: "#FFFFFF",
  fanCircle: "#D5C8FF",
  fanText: "#211A31",
  fanLabel: "#17151F",
  fanCirclePressed: "#C1B0F2",
  fanBackdropOpaque: "#F5F4F8",
  sheetScrim: "#17151F38",
  fanScrim: "#17151F55",
  warningSurface: "#FFF0D5",
  practiceSurface: "#EEE7FF",
  mainnetSurface: "#E8EBFF",
  upSurface: "#E4F4E9",
  downSurface: "#FBE8E5",
  destructiveSurface: "#FBE8E5",
  silver: "#626D7E",
  raised2: "#ECE9F2",
  rowPressed: "#E5E1EE",
  selectedRow: "#E8EBFF",
  skeleton: "#DEDBE6",
  primaryPressed: "#343ED3",
  upForeground: "#FFFFFF",
  downForeground: "#FFFFFF",
  chartNeutral: "#716C7F",
  sheetHandle: "#716C7F",
};

export const PALETTES = { dark: DARK, light: LIGHT } as const;
export type ThemeName = keyof typeof PALETTES;
export const DEFAULT_THEME: ThemeName = "dark";
