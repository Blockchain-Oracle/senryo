/** Ticket constants (F10). The engine supplies fee, caps and max leverage; these are UI choices only. */

/** Leverage detent marks under the slider (shown up to the market's max). */
export const LEVERAGE_DETENTS = [1, 2, 5, 10] as const;
/** Margin quick-picks in whole dollars, beside MAX (= what fits in Free to trade). */
export const AMOUNT_CHIPS_USD = [10n, 25n, 50n] as const;

/** After a gas top-up finalizes, poll the head this often until FUNDING_SETTLE_BLOCKS have passed (Monad ~0.4 s blocks). */
export const BLOCK_POLL_MS = 400;
/** Give up waiting for the settle blocks after this many polls (~6 s) and let the send's own checks decide. */
export const FUNDING_WAIT_POLLS = 15;
