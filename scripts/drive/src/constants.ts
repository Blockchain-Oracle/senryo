/** Drive-script constants (units, oracle stepping, output layout). */

export const DEC = { usd6: 6, feed8: 8, e18: 18 } as const;
export const BPS = 10_000n;
/** 1e18 price → 8-decimal Chainlink answer. */
export const E18_TO_FEED = 10_000_000_000n;
export const MS_PER_SECOND = 1_000;

export const XAU_MARKET = 0;
/** Default deposit (6 AUSD) and leverage (8×) keep one trade under the pool's 20 % trade cap on testnet. */
export const DEFAULT_DEPOSIT_USD6 = "6000000";
export const DEFAULT_LEVERAGE_BPS = "80000";
/** Below the oracle clamp (200 bps) so each round is accepted. */
export const DEFAULT_STEP_BPS = "190";
export const SLIPPAGE_BPS = 50n;
export const DEADLINE_SEC = 120n;
export const MAX_STEPS = 12;
export const RETRY_SHRINK_BPS = 9_500n;
export const MAX_OPEN_TRIES = 3;
export const WAIT = { observeMs: 30_000, liquidationMs: 90_000, pollMs: 1_000 } as const;
export const SHOWN_DIGITS = 4;
export const DEFAULT_KEEPER_URL = "http://127.0.0.1:3002";

/** Console table column widths. */
export const COLS = { step: 28, stage: 9, gas: 7 } as const;
