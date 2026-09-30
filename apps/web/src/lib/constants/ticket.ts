/** Ticket display constants (S1 preview). The real risk mirror lands in packages/core (S3). */
export const LEVERAGE_MIN = 1;
export const LEVERAGE_DETENTS = [1, 2, 5, 10] as const;
/** Preview margin-use curve: 100 − k/lev, clamped. Replaced by the risk mirror's health figure in S3. */
export const MARGIN_USE_K = 110;
export const PERCENT_MAX = 100;
/** Gauge colour stops (% margin use). */
export const GAUGE_WARN_AT = 60;
export const GAUGE_DANGER_AT = 85;
export const GAUGE_PX = 120;
/** Simulated execution trace step interval for the preview (ms). */
export const TRACE_STEP_MS = 420;
