/** Position actions (F11). */

/** Partial-close quick picks, in bps of the position (10 000 = close all). */
export const REDUCE_STEPS_BPS = [2_500n, 5_000n, 7_500n, 10_000n] as const;
export const REDUCE_ALL_BPS = 10_000n;
/** Monad blocks are ~0.4 s; the anti-flash wait is shown in seconds (MIN_HOLD_BLOCKS × this, rounded up). */
export const BLOCK_MS_ESTIMATE = 400n;
