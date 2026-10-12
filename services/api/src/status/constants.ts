/** The Status board's thresholds (P6, D-324): when each component reads degraded, then down. */
export const HEALTH_LIMITS = {
  /** The finalized head's age (s) and the RPC's answer time (ms). */
  headAgeSec: { degraded: 30, down: 300 },
  rpcLatencyMs: { degraded: 2_000, down: 10_000 },
  /** Blocks the indexer trails the head by (Monad: ~0.4 s a block). */
  indexerLagBlocks: { degraded: 150, down: 1_500 },
  /** The oldest relayed request still waiting (s). */
  relayOldestSec: { degraded: 60, down: 600 },
  /** Calls whose window ended this long ago (s) and still aren't settled, and how many make it "down". */
  settleGraceSec: 120,
  overdueDown: 20,
  /** The keeper's newest job run (s), and a job's error counts while it's this recent (s). */
  keeperTickSec: { degraded: 120, down: 600 },
  keeperErrorFreshSec: 600,
} as const;

/** The recorder writes one row a minute (aligned to the minute, so restarts don't double up). */
export const RECORD_EVERY_MS = 60_000;
export const SECONDS_PER_MINUTE = 60;
export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = 1440;
/** The board's two views: 24 hourly buckets and 90 daily ones. */
export const HISTORY_RANGES = { "24h": { buckets: 24, minutes: 60 }, "90d": { buckets: 90, minutes: 1440 } } as const;
