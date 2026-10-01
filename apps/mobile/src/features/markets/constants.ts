/** Markets journey constants (J3). The engine and the api supply every market number; these are UI choices only. */

/** Alert editor one-tap targets: this far from the current price, in the chosen direction (1 %, 2 %, 5 %). */
export const ALERT_SUGGESTIONS_BPS = [100n, 200n, 500n] as const;
/** One percent in basis points, for wording a bps distance as "+2%". */
export const BPS_PER_PERCENT = 100n;
/**
 * The alert editor's sheet stops at half the window and scrolls inside: the sheet rises by the keyboard's height, so a
 * taller panel would push its heading and field under the status bar on a 402×874 phone (≈340 pt keyboard).
 */
export const ALERT_SHEET_MAX_HEIGHT = 0.5;
