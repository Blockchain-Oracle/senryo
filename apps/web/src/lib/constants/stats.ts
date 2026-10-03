/** Public `/stats/` (D-022): request bounds, cache cadence and the daily chart's geometry. */

/** ProtocolDailyStats rows per request (one row per UTC day with any indexed event). */
export const STATS_DAYS_PAGE = 366;
/** At most this many day pages per load (≈ 10 years), so a runaway cursor can never loop. */
export const STATS_DAYS_MAX_PAGES = 10;
/** The figures are counters over minutes, not seconds: one read per minute per network, cached on switch-back. */
export const STATS_STALE_MS = 60_000;
/** The deployment table is part of the build; it never goes stale in a session. */
export const STATS_DEPLOYMENT_STALE_MS = Number.POSITIVE_INFINITY;

/** Daily chart viewBox (SVG user units, scaled uniformly to the column; labels are HTML, so text never shrinks). */
export const DAILY_BARS = {
  width: 544,
  height: 120,
  /** Column cap and the share of a day's slot a column may take (the rest is air between days). */
  maxBar: 24,
  barShare: 0.72,
  /** Rounded data end (square at the baseline). */
  radius: 4,
  /** Headroom above the tallest column before the clean step (1: a peak that is already clean is the top line). */
  headroom: 1,
  /** Column grow-in stagger per day and its cap. */
  staggerMs: 14,
  staggerMaxMs: 280,
} as const;

/** Clean tick steps: {1, 2, 2.5, 5} × 10^k. */
export const NICE_STEP_BASES = [1, 2, 2.5, 5] as const;
export const NICE_STEP_MIN_EXP = 0;
export const NICE_STEP_MAX_EXP = 12;
export const DECIMAL_BASE = 10;
