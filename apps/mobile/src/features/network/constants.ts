/** Network selector (S8.22). */

/** Balances in the selector are glanceable, not money-deciding: a minute is fresh enough. */
export const BALANCE_STALE_MS = 60_000;
/** Pre-launch mainnet prices come straight from Chainlink; their own heartbeat is minutes, so 30 s is plenty. */
export const PRELAUNCH_PRICE_REFETCH_MS = 30_000;
