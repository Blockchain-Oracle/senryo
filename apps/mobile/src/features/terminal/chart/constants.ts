/** The live chart's tuning tables (Tradash's numbers, as Owarine re-implements them; SPEC-chart §2–4). */

export const MS_PER_SECOND = 1000;
/** The fixed sample clock, whatever the display's refresh rate. */
export const SAMPLE_HZ = 60;
/** Nice steps: 1, 2, 5 or 10 × 10ⁿ with cut-offs 1.5 / 3.5 / 7.5. */
export const NICE_CUTS = [1.5, 3.5, 7.5] as const;
export const NICE_STEPS = [1, 2, 5, 10] as const;
/** Display decimals by magnitude: the one table in `@senryo/core` `price-format.ts` (the engine's worklet reads it). */
export {
  PRICE_DECIMAL_BANDS as DECIMAL_BANDS,
  PRICE_MAX_DECIMALS as MAX_DECIMALS,
  PRICE_SIGNIFICANT as SIGNIFICANT,
  PRICE_ZERO_DECIMALS as ZERO_DECIMALS,
} from "@senryo/core";
/** Float slack for grid arithmetic. */
export const EPSILON = 1e-9;
export const THOUSANDS = 3;
/** A 1 px line centred on a pixel row. */
export const HALF_PIXEL = 0.5;
/** Catmull-Rom → Bézier control-point divisor (tension 1/6). */
/** K (fine dash), the entry, and a band's edge or strike (long dash: where Range and Moonshot are decided). */
export const LEVEL_DASH = { line: [2, 3], entry: [4, 4], edge: [8, 4] } as const;
/**
 * The eased price follows the tick cadence it measures (Pyth Starter prints about once a second, D-272: "the chart
 * breathes through client easing, not tick rate"): τ = max(Tradash's 84 ms, 0.5 × the tick interval), so a 1 s feed
 * glides across each second instead of stepping, and a fast feed keeps Tradash's snap.
 */
export const BASE_TAU_MS = 84;
export const TICK_FOLLOW = 0.5;
/** Weight of the newest interval in the tick-cadence average. */
export const TICK_EMA = 0.3;
/** Gaps longer than this (a background, a reconnect) don't count as cadence. */
export const MAX_TICK_GAP_MS = 5000;
/** History that lands this soon after a cold-start terminal's first tick redraws its (still flat) line. */
export const RESEED_WINDOW_MS = 1_000;
/** A price that isn't live (R1.20): the frozen line and its head at this strength, the age tag this far off the pill. */
export const DIM_ALPHA = 0.4;
/** A closed market's session fills this much more than its low-to-high range, so neither touches the edge. */
export const HISTORY_PAD = 1.15;

/** A closed market's last session for the UI thread (`sessionHistory`), numbered so it is loaded once. */
export interface ChartHistory {
  seq: number;
  line: number[];
  low: number;
  high: number;
  close: number;
}
export const HEALTH_TAG_GAP = 6;

/** Whether the price is live, and its age or state for the tag when it isn't (`PriceHealth`, R1.20). */
export interface ChartHealth {
  live: boolean;
  tag: string | null;
}
export const LIVE: ChartHealth = { live: true, tag: null };
export const LEVEL_ALPHA = { line: 0.7, entry: 0.55, edge: 0.6 } as const;
