/** The terminal's choices (S5). */

/** Stake presets in whole dollars ($1 · $5 · $10 · $25, then Max). */
export const STAKE_PRESETS_USD = [1, 5, 10, 25] as const;
/** The default stake and the least one ($5, $1), dollar base units. */
export const DEFAULT_STAKE = 5_000_000;
export const MIN_STAKE = 1_000_000n;
/** Close part of a position: 25, 50 or 75 % or all of it (Codex direction 11 §3). */
export const PART_PERCENTS = [25n, 50n, 75n, 100n] as const;
/** Hold CLOSE for a part, TRAIL for the full exit (ms). */
export const HOLD_MS = 450;
