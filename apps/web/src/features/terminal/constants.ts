/** The web terminal's choices (the phone's `features/terminal/constants.ts`). */

/** Stake presets in whole dollars ($1 · $5 · $10 · $25, then any amount and Max). */
export const STAKE_PRESETS_USD = [1, 5, 10, 25] as const;
/** Cash out a part: 25 %, 50 % or all of it. */
export const CASH_OUT_PARTS = [25n, 50n, 100n] as const;
export const DEFAULT_STAKE = 5_000_000n;
export const MIN_STAKE = 1_000_000n;
