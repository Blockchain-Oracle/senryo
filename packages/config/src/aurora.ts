/**
 * Aurora Intents (NEAR Intents) for any-chain deposits and cross-chain withdrawals (S9; docs/research/pivot/aurora.md).
 * Swap/Deposits endpoints take the Studio API key in the path; Connect takes it in `x-api-key`. The key is server-only.
 */
export const AURORA_API = "https://intents-api.aurora.dev/api";
export const AURORA_CONNECT_API = "https://intents-connect-api.aurora.dev";

/** Aurora's asset id for Circle USDC on Monad (= 0x754704Bc…b603), from the live token list on 8 Oct 2026. */
export const AURORA_MONAD_USDC = "nep245:v2_1.omni.hot.tg:143_2dmLwYWkCQKyTjeUPAsGJuiVLbFx";

/** Rate limits per key and endpoint: 100 per 10 s and 2,000 per hour (poll only while a deposit is pending). */
export const AURORA_POLL_OPEN_MS = 5_000;
export const AURORA_POLL_PENDING_MS = 30_000;
