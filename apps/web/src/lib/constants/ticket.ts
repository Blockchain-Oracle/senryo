/** Ticket display constants. The figures come from the `@senryo/core` risk preview; these only shape the controls. */
export const LEVERAGE_MIN = 1;
/** Quick-set stops under the leverage track; only those at or below the market's own maximum are drawn. */
export const LEVERAGE_DETENTS = [1, 2, 5, 10, 20, 50] as const;
/** Funding settle wait after a sponsored network-fee top-up (as on the phone): poll the head this often, this many times. */
export const BLOCK_POLL_MS = 400;
export const FUNDING_WAIT_POLLS = 15;
/** While a signed send's result is unknown, the journal is re-read this often until recovery settles it. */
export const JOURNAL_POLL_MS = 3_000;
/** Quick margin presets in the ticket (flow book C3: $10 / $50 / $100 / Max), in whole money units. */
export const MARGIN_PRESETS = [10n, 50n, 100n] as const;
/** Per-browser flags: the risk explainer was accepted (general, and for a first short). */
export const TRADE_STORAGE = {
  riskExplained: "senryo.risk-explained.v1",
  shortRiskExplained: "senryo.short-risk-explained.v1",
} as const;
/** Reduce a position by a share of its size (flow book C5: 25 / 50 / 75 / 100 %), in bps. */
export const REDUCE_STEPS_BPS = [2_500n, 5_000n, 7_500n, 10_000n] as const;
export const REDUCE_ALL_BPS = 10_000n;
/** The chain head is re-read this often on the position page (a profitable reduce waits out MIN_HOLD blocks). */
export const HEAD_REFETCH_MS = 2_000;
