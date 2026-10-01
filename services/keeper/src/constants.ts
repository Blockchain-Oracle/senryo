/** Keeper defaults (all overridable by env). Contract-mirrored values cite contracts/src/libraries/Constants.sol. */

export const KEEPER_PORT = 3002;

/** `/health` fails when the scheduler has not ticked for this long (specs/services.md keeper). */
export const KEEPER_STALE_SEC = 120;

export const INTERVALS_MS = {
  liquidate: 1_000,
  observe: 2_000,
  mirror: 15_000,
  triggers: 2_000,
  holds: 60_000,
  alerts: 10_000,
  wallets: 60_000,
  retention: 86_400_000,
  sweeps: 15_000,
} as const;

/** Retention windows in days (S8.5b K9). */
export const RETENTION_DAYS = {
  siweNonces: 1,
  latency: 30,
  events: 90,
  pushSends: 30,
  outbox: 30,
  cardEvents: 90,
  inboxWatches: 30,
} as const;

/**
 * Testnet mirror relay: push when the mainnet answer moved ≥ this many bps since the last mirrored answer, or when
 * the mirror is older than the heartbeat (must stay under the testnet feed's 3,600 s heartbeat + 600 s FEED_GRACE,
 * else the market goes STALE).
 */
export const MIRROR_DEVIATION_BPS = 50;
export const MIRROR_HEARTBEAT_SEC = 3_000;
/**
 * FX mirrors (S8.23): the testnet oracle ages them against SeedConstants.FX_MIRROR_HEARTBEAT (10,800 s) + 600 s grace.
 * FX moves ≈ 0.5 %/day, so relaying every 9,000 s (plus ≥ MIRROR_DEVIATION_BPS moves) costs ≈ 10 pushes/day/feed
 * instead of ≈ 29 — five feeds ≈ 0.7 tMON/day at 102 gwei, not ≈ 2.1 (D-188).
 */
export const MIRROR_FX_HEARTBEAT_SEC = 9_000;

/**
 * Observe budget (S8.23, D-188): with open interest, poke when the feed has drifted this far from the persisted
 * price — half of SeedConstants.CLAMP_BPS (200), so a sustained move never parks a market with positions in CIRCUIT.
 */
export const OBSERVE_DRIFT_BPS = 100;
/**
 * While the market is CIRCUIT (a relay push jumped past the clamp), keep pushing the same source answer this often so
 * SessionOracle self-confirms: ≥ 3 in-band rounds spanning ≥ CONFIRM_SECONDS (300 s) — D-055/D-056.
 */
export const MIRROR_CONFIRM_PUSH_SEC = 155;

/** Constants.sol: HOLD_TTL 7 d, HOLD_RELEASE_GRACE 1 d — after expiry + grace anyone may `releaseExpiredHold`. */
export const HOLD_TTL_SEC = 7 * 86_400;
export const HOLD_RELEASE_GRACE_SEC = 86_400;
export const HOLD_RELEASABLE_AFTER_SEC = HOLD_TTL_SEC + HOLD_RELEASE_GRACE_SEC;

/** Health warning when liquidation equity is within this margin above maintenance (bps of MM). */
export const HEALTH_WARN_MARGIN_BPS = 5_000;

/** Wallet floor below which an ops alert fires (testnet default 0.05 MON; mainnet set by env ≥ 10 MON rule). */
export const WALLET_FLOOR_WEI = 50_000_000_000_000_000n;

/**
 * Deposit inbox sweeps (S8.24): at most this many sends per tick (a burst of dust-above-minimum deposits can't drain
 * the keeper in one go), and a failed sweep waits this long before the next attempt.
 */
export const SWEEPS_PER_TICK = 10;
export const SWEEP_RETRY_MS = 300_000;

export const BPS = 10_000n;

/** Indexer candidate queries (display-only data; a slow indexer must not stall the scan loop). */
export const INDEXER_TIMEOUT_MS = 3_000;
/** Max candidates per indexer query (users with open positions, PLACED triggers). */
export const SCAN_LIMIT = 500;
/** Page cap for the indexer scans (40 × 500 = 20 000 rows); hitting it logs a warning. */
export const MAX_SCAN_PAGES = 40;
