/**
 * The one palette (UGLYCASH, D-304; replan R2.1): the phone's native colours (evidence U04/U14/U16) are the source for
 * web and phone alike — near-black and white grounds, black (light) or white (dark) primary actions, `#FA00FF` with
 * black ink for trade, selected and publish controls, and the direction colours (D-316): acid green for Up, coral for
 * Down, cyan for Range — vivid fills with black labels on the call buttons, and per-theme inks that read as text and
 * lines (≥ 4.5:1 on the ground). Light is the default; dark is an accessible adaptation. The first block keeps the shadcn/Tailwind names the web maps; the second the app roles.
 * `packages/tokens/scripts/emit-css.ts` writes `tokens.css` from here. Eight-digit values are `#RRGGBBAA`.
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
  | "chart2"
  | "chart3"
  | "chart4"
  | "chartUp"
  | "chartDown"
  /** Range's ink (D-316): cyan, a band rather than a direction. */
  | "range"
  /** Mode identity: Practice and Real read in neutral plates (UGLYCASH); the mode is in the words, never a hue. */
  | "practice"
  | "mainnet";

type AppRole =
  /** The brand seal's disc on the web's rail and top line: black in both themes, no glow (R2.2). */
  | "seal"
  /** Text 2 (= mutedForeground) and Text 3 (tertiary metadata, ≥ 4.5:1 on the ground in both themes). */
  | "text2"
  | "text3"
  | "link"
  /** Dock material: tint over live blur, decorative rim, and the opaque reduced-transparency equivalent. */
  | "glassTint"
  | "glassRim"
  | "glassOpaque"
  /** Sheets dim the page behind them. */
  | "sheetScrim"
  /** Opaque status plates (ink: warn / practice / mainnet / up / down). */
  | "warningSurface"
  | "practiceSurface"
  | "mainnetSurface"
  | "upSurface"
  | "downSurface"
  | "destructiveSurface"
  /** Neutral elevated/control fill, pressed and selected rows, loading geometry. */
  | "raised2"
  | "rowPressed"
  | "selectedRow"
  | "skeleton"
  | "primaryPressed"
  /** The call buttons' fills (D-316): vivid in both themes, black labels, and a darker 3 px bottom edge. */
  | "upFill"
  | "downFill"
  | "rangeFill"
  | "upFillEdge"
  | "downFillEdge"
  | "rangeFillEdge"
  /** The label on a direction fill (black in both themes). */
  | "onDirectionFill"
  /** Ink on the up/down inks used as plates (the chart's price pill, Yes/No): white in light, black in dark. */
  | "upForeground"
  | "downForeground"
  | "chartNeutral"
  | "sheetHandle";

export type ColorRole = ShadcnRole | AppRole;
export type Palette = Readonly<Record<ColorRole, string>>;

/** The default. Background · raised (`card`) · sheet (`popover`); Text 1 / Text 2 (`mutedForeground`). */
export const LIGHT: Palette = {
  background: "#F5F5F5",
  foreground: "#000000",
  card: "#FFFFFF",
  cardForeground: "#000000",
  popover: "#F5F5F5",
  popoverForeground: "#000000",
  primary: "#000000",
  primaryForeground: "#FFFFFF",
  secondary: "#ECECEC",
  secondaryForeground: "#000000",
  muted: "#ECECEC",
  mutedForeground: "#666666",
  accent: "#FA00FF",
  accentForeground: "#000000",
  destructive: "#C83225",
  destructiveForeground: "#FFFFFF",
  border: "#D4D4D4",
  input: "#ECECEC",
  ring: "#FA00FF",
  surface: "#FFFFFF",
  up: "#2F7A00",
  down: "#C8283F",
  gold: "#89611F",
  warn: "#8A5800",
  chart2: "#666666",
  chart3: "#087A8A",
  chart4: "#AD3265",
  chartUp: "#2F7A00",
  chartDown: "#C8283F",
  range: "#00727E",
  practice: "#666666",
  mainnet: "#000000",

  seal: "#000000",
  text2: "#666666",
  text3: "#6E6E6E",
  link: "#99009C",
  glassTint: "#ECECECEB",
  glassRim: "#FFFFFFB3",
  glassOpaque: "#ECECEC",
  sheetScrim: "#000000B3",
  warningSurface: "#FFF0D5",
  practiceSurface: "#ECECEC",
  mainnetSurface: "#E2E2E2",
  upSurface: "#EEF9DC",
  downSurface: "#FDE7EA",
  destructiveSurface: "#FBE8E5",
  raised2: "#ECECEC",
  rowPressed: "#E2E2E2",
  selectedRow: "#FCE3FC",
  skeleton: "#DEDEDE",
  primaryPressed: "#252525",
  upFill: "#B5F543",
  downFill: "#FF647C",
  rangeFill: "#3FE0F0",
  upFillEdge: "#7FB224",
  downFillEdge: "#D9435C",
  rangeFillEdge: "#1FA8B6",
  onDirectionFill: "#000000",
  upForeground: "#FFFFFF",
  downForeground: "#FFFFFF",
  chartNeutral: "#6E6E6E",
  sheetHandle: "#999999",
};

/** The dark adaptation; a saved dark choice survives the light default. */
export const DARK: Palette = {
  background: "#111111",
  foreground: "#F5F5F5",
  card: "#1C1C1C",
  cardForeground: "#F5F5F5",
  popover: "#171717",
  popoverForeground: "#F5F5F5",
  primary: "#F5F5F5",
  primaryForeground: "#000000",
  secondary: "#292929",
  secondaryForeground: "#F5F5F5",
  muted: "#292929",
  mutedForeground: "#B8B8B8",
  accent: "#FA00FF",
  accentForeground: "#000000",
  destructive: "#FF5A48",
  destructiveForeground: "#000000",
  border: "#414141",
  input: "#292929",
  ring: "#FA00FF",
  surface: "#1C1C1C",
  up: "#B5F543",
  down: "#FF647C",
  gold: "#D4AE5B",
  warn: "#F2B85C",
  chart2: "#B8B8B8",
  chart3: "#5CCAD8",
  chart4: "#F18BB7",
  chartUp: "#B5F543",
  chartDown: "#FF647C",
  range: "#3FE0F0",
  practice: "#B8B8B8",
  mainnet: "#F5F5F5",

  seal: "#000000",
  text2: "#B8B8B8",
  text3: "#A0A0A0",
  link: "#FF75FF",
  glassTint: "#292929EB",
  glassRim: "#FFFFFF24",
  glassOpaque: "#292929",
  sheetScrim: "#000000B3",
  warningSurface: "#332719",
  practiceSurface: "#292929",
  mainnetSurface: "#363636",
  upSurface: "#1E2A0C",
  downSurface: "#3A1A20",
  destructiveSurface: "#35201F",
  raised2: "#292929",
  rowPressed: "#363636",
  selectedRow: "#3C203C",
  skeleton: "#363636",
  primaryPressed: "#DEDEDE",
  upFill: "#B5F543",
  downFill: "#FF647C",
  rangeFill: "#3FE0F0",
  upFillEdge: "#7FB224",
  downFillEdge: "#D9435C",
  rangeFillEdge: "#1FA8B6",
  onDirectionFill: "#000000",
  upForeground: "#000000",
  downForeground: "#000000",
  chartNeutral: "#A0A0A0",
  sheetHandle: "#999999",
};

export const PALETTES = { light: LIGHT, dark: DARK } as const;
export type ThemeName = keyof typeof PALETTES;
export const DEFAULT_THEME: ThemeName = "light";
