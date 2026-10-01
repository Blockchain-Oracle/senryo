/**
 * "Living Lacquer" type, space, radius and motion scales (direction §3–4, v2-plan §5.3–5.4; values from the S1b.6 Codex
 * consult, D-191). Inter 400–700 for UI, Inter Display SemiBold for big numbers (≥ 32), tabular lining figures for money,
 * sentence/title case with no tracked uppercase. Exact source fonts and springs are declared adaptations.
 */

export const FONT = {
  sans: "Inter",
  display: "Inter Display",
  /** Legacy alias: amounts used a monospace face in D2; they are now Inter with tabular lining figures. */
  mono: "Inter",
} as const;

/** `display` roles use Inter Display; `numeric` roles turn on tabular + lining figures (`tnum`, `lnum`). */
export type TypeFace = "sans" | "display";
interface TypeSpec {
  size: number;
  lineHeight: number;
  /** em; display sizes track −0.02 em. */
  tracking: number;
  weight: 400 | 500 | 600 | 700;
  font: TypeFace;
  numeric: boolean;
}

/** Font sizes in px (web converts to rem at 16 px; mobile uses points). Step 1: the existing role names, new values. */
export const TYPE = {
  micro: { size: 12, lineHeight: 16, tracking: 0, weight: 500, font: "sans", numeric: false },
  label: { size: 12, lineHeight: 16, tracking: 0, weight: 600, font: "sans", numeric: false },
  caption: { size: 12, lineHeight: 16, tracking: 0, weight: 400, font: "sans", numeric: false },
  body: { size: 16, lineHeight: 22, tracking: 0, weight: 400, font: "sans", numeric: false },
  bodyStrong: { size: 16, lineHeight: 22, tracking: 0, weight: 600, font: "sans", numeric: false },
  title: { size: 20, lineHeight: 24, tracking: 0, weight: 600, font: "sans", numeric: false },
  numSm: { size: 16, lineHeight: 20, tracking: 0, weight: 500, font: "sans", numeric: true },
  numMd: { size: 20, lineHeight: 24, tracking: 0, weight: 600, font: "sans", numeric: true },
  numTicker: { size: 40, lineHeight: 44, tracking: -0.02, weight: 600, font: "display", numeric: true },
  numLg: { size: 40, lineHeight: 44, tracking: -0.02, weight: 600, font: "display", numeric: true },
  numXl: { size: 52, lineHeight: 56, tracking: -0.02, weight: 600, font: "display", numeric: true },
  numHero: { size: 52, lineHeight: 56, tracking: -0.02, weight: 600, font: "display", numeric: true },
} as const satisfies Record<string, TypeSpec>;
export type TypeRole = keyof typeof TYPE;

/** Spacing in px on a 4 px grid (2 is an optical micro-gap only). */
export const SPACE = { none: 0, xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

/** Step 1: `sm` (every existing corner) becomes 12 until each component takes its own step of the 8/12/16/24/32 scale. */
export const RADIUS = { none: 0, sm: 12, pill: 999 } as const;
/** Ordinary divider/border stroke. */
export const HAIRLINE_PX = 1;

/** Motion (ms): press 100, selection 170, page push 320, number change 160, on `cubic-bezier(0.2, 0.8, 0.2, 1)`. */
export const MOTION = {
  fastMs: 100,
  baseMs: 170,
  slowMs: 320,
  flashInMs: 160,
  flashOutMs: 160,
  easing: [0.2, 0.8, 0.2, 1] as const,
} as const;

/** Largest Dynamic Type multiplier for hero numbers (layout stays intact). */
export const MAX_FONT_SCALE_HERO = 1.3;
