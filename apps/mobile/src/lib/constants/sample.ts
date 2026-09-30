/** Parameters of the deterministic preview series in `src/lib/sample.ts` (no randomness at runtime). */
export const SAMPLE_SEED = 20_261_013;
export const EQUITY_POINTS = 96;
export const EQUITY_STEP_MS = 15 * 60 * 1_000;
/** Equity walk: ±0.35% per step with a slight upward drift, in bps. */
export const EQUITY_STEP_BPS = 35;
export const EQUITY_DRIFT_BPS = 4;
export const CANDLE_COUNT = 48;
export const CANDLE_STEP_MS = 60 * 60 * 1_000;
export const CANDLE_BODY_BPS = 30;
export const CANDLE_WICK_BPS = 18;
export const SPARK_POINTS = 24;
export const SPARK_STEP_BPS = 60;
/** mulberry32 constants. */
export const PRNG = { inc: 0x6d2b79f5, m1: 15, m2: 7, m3: 61, s1: 14, max: 4_294_967_296 } as const;
