/** Kinpaku daily-limit presets (whole dollars; D-032). The second ($100) is the default. */
export const CARD_LIMIT_CHIPS_USD = [50n, 100n, 250n, 500n] as const;
export const DEFAULT_LIMIT_USD = 100n;

/**
 * The corrected risk fact (e-card.md "Holds and debt count against liquidation equity"): a payment is approved only if
 * it fits Spendable, but the hold and any debt then lower liquidation equity. Used by the intro, the Spendable ⓘ and
 * the breakdown.
 */
export const CARD_RISK_LINE = "Card holds and debt count against your positions.";

/** List rows fade in this far apart, once per mount (Part A rule 7). */
export const ROW_STAGGER_MS = 30;
