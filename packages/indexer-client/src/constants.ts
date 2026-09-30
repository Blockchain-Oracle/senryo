/** Hasura's GraphQL path on the indexer origin (INDEXER_ORIGIN in @senryo/config). */
export const GRAPHQL_PATH = "/v1/graphql";
/** A request that takes longer is treated as the indexer being down (Reading → stale/failed, never a zero). */
export const DEFAULT_TIMEOUT_MS = 8_000;
/** Page sizes for the history screens. Hasura's response limit is the upper bound. */
export const PAGE_SIZE = {
  activity: 50,
  fills: 50,
  positions: 50,
  candles: 300,
  equity: 500,
  statsDays: 30,
} as const;
/** Daily aggregates are keyed by UTC day index = floor(unix seconds / SECONDS_PER_DAY) (indexer dayOf). */
export const SECONDS_PER_DAY = 86_400;
/** Candle intervals the indexer maintains (seconds): 5m, 15m, 1h, 4h, 1d (indexer/src/lib/constants.ts). */
export const CANDLE_INTERVALS = [300, 900, 3_600, 14_400, 86_400] as const;
export type CandleInterval = (typeof CANDLE_INTERVALS)[number];
