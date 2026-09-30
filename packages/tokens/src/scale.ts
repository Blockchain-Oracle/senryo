/**
 * D2 Desk type, space, radius and motion scales (D-004): Inter for labels, JetBrains Mono tabular for every number,
 * 4 px radius, hairlines, 120–200 ms motion, "nothing bounces".
 */

export const FONT = {
  sans: "Inter",
  mono: "JetBrains Mono",
} as const;

/** Font sizes in px (web converts to rem at 16 px; mobile uses points). */
export const TYPE = {
  micro: { size: 10, lineHeight: 14, tracking: 0.12, weight: 500, font: "mono", uppercase: true },
  label: { size: 11, lineHeight: 14, tracking: 0.12, weight: 500, font: "sans", uppercase: true },
  caption: { size: 12, lineHeight: 16, tracking: 0, weight: 400, font: "sans", uppercase: false },
  body: { size: 14, lineHeight: 20, tracking: 0, weight: 400, font: "sans", uppercase: false },
  bodyStrong: { size: 14, lineHeight: 20, tracking: 0, weight: 600, font: "sans", uppercase: false },
  title: { size: 17, lineHeight: 22, tracking: 0, weight: 600, font: "sans", uppercase: false },
  numSm: { size: 13, lineHeight: 18, tracking: 0, weight: 500, font: "mono", uppercase: false },
  numMd: { size: 16, lineHeight: 22, tracking: 0, weight: 500, font: "mono", uppercase: false },
  numTicker: { size: 24, lineHeight: 30, tracking: -0.02, weight: 600, font: "mono", uppercase: false },
  numLg: { size: 28, lineHeight: 34, tracking: -0.02, weight: 600, font: "mono", uppercase: false },
  numXl: { size: 34, lineHeight: 40, tracking: -0.03, weight: 600, font: "mono", uppercase: false },
  numHero: { size: 40, lineHeight: 46, tracking: -0.03, weight: 600, font: "mono", uppercase: false },
} as const;
export type TypeRole = keyof typeof TYPE;

/** Spacing in px on a 4 px grid. */
export const SPACE = { none: 0, xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

/** D2 uses 4 px corners and hairline borders; no shadows. */
export const RADIUS = { none: 0, sm: 4, pill: 999 } as const;
export const HAIRLINE_PX = 1;

/** Motion (ms) — `bezier(0.2, 0, 0, 1)`, no overshoot except sheets. */
export const MOTION = {
  fastMs: 120,
  baseMs: 160,
  slowMs: 200,
  flashInMs: 120,
  flashOutMs: 600,
  easing: [0.2, 0, 0, 1] as const,
} as const;

/** Largest Dynamic Type multiplier for hero numbers (layout stays intact). */
export const MAX_FONT_SCALE_HERO = 1.3;
