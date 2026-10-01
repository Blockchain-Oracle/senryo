/** Ticket constants (F10 → J4). The engine supplies fee, caps and max leverage; these are UI choices only. */

/** Margin presets in whole dollars (Fomo F37 shows $10/$50/$100/$300), beside Max (= what fits in Free to trade). */
export const AMOUNT_CHIPS_USD = [10n, 50n, 100n] as const;

/** After a gas top-up finalizes, poll the head this often until FUNDING_SETTLE_BLOCKS have passed (Monad ~0.4 s blocks). */
export const BLOCK_POLL_MS = 400;
/** Give up waiting for the settle blocks after this many polls (~6 s) and let the send's own checks decide. */
export const FUNDING_WAIT_POLLS = 15;

/** Leverage ruler (C40/M14): one leverage step per this many points; the edges fade over this many steps. */
export const RULER_STEP = 44;
export const RULER_FADE_STEPS = 2.5;
export const RULER_MIN_OPACITY = 0.12;
export const RULER_TICK = 6;
/** A flick carries the ruler this many seconds' worth of its release velocity before it snaps (direct gesture). */
export const RULER_FLING_SEC = 0.12;

/** Quantity display: base-unit decimals in the ticket (the size is 1e18 units). */
export const QUANTITY_DECIMALS = 4;
/** TP/SL % suggestions above the keyboard (Fomo F45 shows −10/−15/−25/−50 % for stop loss), as bps of the mark. */
export const TRIGGER_SUGGESTIONS_BPS = [1_000n, 1_500n, 2_500n, 5_000n] as const;
/** TP/SL percent input: two decimals of a percent, i.e. 1 bp resolution. */
export const PERCENT_DECIMALS = 2;
