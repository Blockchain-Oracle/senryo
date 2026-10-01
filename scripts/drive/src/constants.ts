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
/** $5,000 in 1e18 (an alert far above the market). */
export const XAU_ALERT_PRICE18 = 5_000n * 10n ** 18n;

/** S3.3 swap check: 100 USDC in, 10 bps min-out guard, fork-only funding cheats. */
export const SWAP = {
  amountUsd6: 100_000_000n,
  bps: 10_000n,
  slippageBps: 10n,
  permitTtlSec: 3_600,
  forkMon: "0x8ac7230489e80000",
  adminGas: "0x30d40",
} as const;

/** Console table column widths. */
export const COLS = { step: 28, stage: 9, gas: 7 } as const;

/** trigger-outcome-check: synthetic hashes and levels (no chain is touched). */
export const CHECK_HASH_A = `0x${"a1".repeat(32)}` as const;
export const CHECK_HASH_B = `0x${"b2".repeat(32)}` as const;
export const CHECK_HASH_C = `0x${"c3".repeat(32)}` as const;
export const CHECK_SL_PRICE18 = 4_000n * 10n ** 18n;
export const CHECK_TP_PRICE18 = 4_400n * 10n ** 18n;
export const CHECK_MARKET_ID = 0;
export const CHECK_OTHER_MARKET_ID = 1;
export const CHECK_MAINNET_CHAIN_ID = 143;
export const CHECK_TESTNET_CHAIN_ID = 10143;
