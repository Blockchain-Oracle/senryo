/** The live chart's tuning tables (Tradash's numbers, as Owarine re-implements them; SPEC-chart §2–4). */

export const MS_PER_SECOND = 1000;
/** The fixed sample clock, whatever the display's refresh rate. */
export const SAMPLE_HZ = 60;
/** Nice steps: 1, 2, 5 or 10 × 10ⁿ with cut-offs 1.5 / 3.5 / 7.5. */
export const NICE_CUTS = [1.5, 3.5, 7.5] as const;
export const NICE_STEPS = [1, 2, 5, 10] as const;
/** Display decimals by magnitude: ≥1e5 → 1, ≥1e3 → 2, ≥10 → 3, ≥0.01 → 4; smaller → enough for 3 significant. */
export const DECIMAL_BANDS = [
  { min: 1e5, decimals: 1 },
  { min: 1e3, decimals: 2 },
  { min: 10, decimals: 3 },
  { min: 0.01, decimals: 4 },
] as const;
export const SIGNIFICANT = 3;
export const ZERO_DECIMALS = 2;
export const MAX_DECIMALS = 10;
/** Float slack for grid arithmetic. */
export const EPSILON = 1e-9;
export const THOUSANDS = 3;
/** A 1 px line centred on a pixel row. */
export const HALF_PIXEL = 0.5;
/** Catmull-Rom → Bézier control-point divisor (tension 1/6). */
export const CATMULL = 6;
export const LEVEL_DASH = { line: [2, 3], entry: [4, 4] } as const;
export const LEVEL_ALPHA = { line: 0.7, entry: 0.55 } as const;
