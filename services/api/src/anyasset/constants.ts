/** Timings and limits of the any-asset layer (holdings, swap quotes, bridges — D6/D2). Milliseconds unless stated. */

/** A holdings response is reused for this long per (chain, address) — the route's "cache ~20 s". */
export const HOLDINGS_CACHE_MS = 20_000;
/** HyperSync rescans an address's new blocks at most this often (the token's budget is shared with the indexer). */
export const HYPERSYNC_RESCAN_MS = 60_000;
/** Pages (queries) one scan may spend; a long history finishes over the next scans. */
export const HYPERSYNC_PAGES_PER_SCAN = 3;
export const HYPERSYNC_TIMEOUT_MS = 10_000;
/** Back off this long after a 429 without a reset header. */
export const HYPERSYNC_BACKOFF_MS = 60_000;
/** A scan state is kept this long after its last scan (7 days), so a returning address scans only new blocks. */
export const SCAN_STATE_TTL_MS = 604_800_000;
/** Per-address scan states kept in memory (oldest dropped first). */
export const SCAN_STATES_MAX = 20_000;
/**
 * A scan stores movements and moves its cursors only this many blocks below HyperSync's newest block (Monad finalizes
 * two blocks behind the proposal; one more for margin), so a reorg never leaves a stored transfer behind.
 */
export const HYPERSYNC_FINALITY_BLOCKS = 3;
/**
 * When internal calls trail transfers by at most this many blocks (~10 min; one starved budget window in steady
 * state), wallet activity holds back the newer transactions until both cursors have read them, so a swap that ends in
 * MON never shows first as "Sent 10 USDC". A wider gap (a first scan) shows everything, marked incomplete.
 */
export const HYPERSYNC_SETTLE_GAP_BLOCKS = 1_500;
/** Wallet movements per INSERT statement (12 columns, well under Postgres's 65,535 parameters). */
export const WALLET_INSERT_CHUNK = 1_000;

/** Monad token lists are refreshed this often; a failed refresh keeps the last good copy. */
export const TOKEN_LIST_TTL_MS = 21_600_000;
/** The list is ~100 KB from raw.githubusercontent.com; a slow edge can take several seconds. */
export const TOKEN_LIST_TIMEOUT_MS = 20_000;
/** Verified-token prices (GeckoTerminal allows ~10–30 calls a minute per IP). */
export const PRICE_TTL_MS = 60_000;
/** A price older than this is no longer served when GeckoTerminal is unreachable. */
export const PRICE_STALE_MAX_MS = 600_000;
/** Unverified-token images and token metadata (misses included) are cached this long. */
export const IMAGE_TTL_MS = 86_400_000;
export const METADATA_TTL_MS = 86_400_000;
/** After a GeckoTerminal 429, wait this long before calling it again. */
export const GECKO_BACKOFF_MS = 60_000;
/** Alchemy Portfolio pages per discovery (≤ 100 tokens each). */
export const ALCHEMY_PAGES_MAX = 3;
/** The XAU feed reference is re-read at most this often. */
export const REFERENCE_FEED_TTL_MS = 30_000;

/** Every provider call (aggregators, bridges, prices) gives up after this. */
export const PROVIDER_TIMEOUT_MS = 8_000;
/** A swap quote is re-fetched before review after this many seconds (KyberSwap's calldata lives 300 s). */
export const SWAP_QUOTE_TTL_SEC = 60;
/** Aurora's incident feed is re-read at most this often. */
export const AURORA_POLL_MS = 60_000;

/** Per-IP rate limits of the public any-asset routes. */
export const HOLDINGS_RATE = { rateLimit: { max: 60, timeWindow: "1 minute" } } as const;
export const WALLET_ACTIVITY_RATE = { rateLimit: { max: 60, timeWindow: "1 minute" } } as const;
export const SWAP_QUOTE_RATE = { rateLimit: { max: 60, timeWindow: "1 minute" } } as const;
export const BRIDGE_QUOTE_RATE = { rateLimit: { max: 30, timeWindow: "1 minute" } } as const;
export const BRIDGE_READ_RATE = { rateLimit: { max: 120, timeWindow: "1 minute" } } as const;
