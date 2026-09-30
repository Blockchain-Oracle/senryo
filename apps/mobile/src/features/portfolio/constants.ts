/** Portfolio chart windows (seconds) per timeframe chip; ALL = a year (the indexer keeps every snapshot). */
export const WINDOW_SEC = { "1H": 3_600, "24H": 86_400, "1W": 604_800, "1M": 2_592_000, ALL: 31_536_000 } as const;
export const DAY_SEC = 86_400;
export const MS_PER_SECOND = 1000;
/** F12 post-mortem window: a liquidation in the last 7 days shows its card until dismissed. */
export const LIQUIDATION_WINDOW_SEC = 604_800;
/** F26 collateral swap: share of the source token's balance, in bps. */
export const COLLATERAL_STEPS_BPS = [2_500n, 5_000n, 10_000n] as const;
