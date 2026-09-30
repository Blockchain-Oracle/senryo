/** Timings and canonical addresses for the sender. Chain ids, RPC URLs and gas budgets live in `@senryo/config`. */

/** Canonical Multicall3 (deployed on Monad mainnet and testnet — context/02-monad/contracts-and-tokens.md). */
export const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;

/** Base-fee cache refresh (card path: "cached base fee (1 s refresh)", specs/services.md). */
export const FEE_REFRESH_MS = 1_000;

/** How long `eth_sendRawTransactionSync` may hold the request server-side before we fall back to receipt polling. */
export const SEND_SYNC_TIMEOUT_MS = 2_000;

/** Per-request HTTP timeout for reads. */
export const HTTP_TIMEOUT_MS = 4_000;

/** Receipt / commit-state polling interval when no WS head feed is available (half a block). */
export const POLL_INTERVAL_MS = 150;

/** Give up waiting for a receipt after this (the tx is then `abandoned` unless it shows up later — never resent). */
export const RECEIPT_TIMEOUT_MS = 12_000;

/** Give up waiting for `finalized` after this (finality is ~600–900 ms; this only guards a stalled feed). */
export const FINALIZE_TIMEOUT_MS = 15_000;

/** Recent finalized heights whose block hash the head tracker remembers (reorg check for receipts). */
export const FINALIZED_HASH_WINDOW = 512;

/** No `monadNewHeads` update for this long ⇒ the tracker polls instead and re-subscribes. */
export const HEAD_FEED_STALE_MS = 3_000;

/** BPS denominator (bigint) for gas maths. */
export const BPS = 10_000n;
