/** Ticket constants (F10). The engine supplies fee, caps and max leverage; these are UI choices only. */

/** Leverage detent marks under the slider (shown up to the market's max). */
export const LEVERAGE_DETENTS = [1, 2, 5, 10] as const;
/** Margin quick-picks in whole dollars, beside MAX (= what fits in Free to trade). */
export const AMOUNT_CHIPS_USD = [10n, 25n, 50n] as const;
