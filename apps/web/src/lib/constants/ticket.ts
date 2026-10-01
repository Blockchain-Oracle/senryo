/** Ticket display constants. The figures come from the `@senryo/core` risk preview; these only shape the controls. */
export const LEVERAGE_MIN = 1;
/** Quick-set stops under the leverage track; only those at or below the market's own maximum are drawn. */
export const LEVERAGE_DETENTS = [1, 2, 5, 10, 20, 50] as const;
/** Gauge colour stops (% margin use: maintenance margin ÷ liquidation equity after the trade). */
export const GAUGE_WARN_AT = 60;
export const GAUGE_DANGER_AT = 85;
export const GAUGE_PX = 120;
