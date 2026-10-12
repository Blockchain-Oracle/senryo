/** History from the indexer (S4). */

/** Calls per page of a caller's history. */
export const CALLS_PAGE = 50;
export const LEADERBOARD_SIZE = 50;
export const SECONDS_PER_DAY = 86_400;
export const DAYS_PER_WEEK = 7;
/** The Postgres schema Envio writes (`ENVIO_PG_SCHEMA`); the api only reads it. */
export const DEFAULT_INDEXER_SCHEMA = "envio";
/** History is a few seconds behind the chain at most; a short edge cache absorbs bursts of the same read. */
export const HISTORY_MAX_AGE = "public, max-age=2";
export const LEADERBOARD_MAX_AGE = "public, s-maxage=30, max-age=10";

/** Windows per page of the Proof feed. */
export const WINDOWS_PAGE = 30;

/** Earn's hourly results shown per chart range (P5: 1D, 7D, 30D); one more row gives the first hour's change. */
export const EPOCH_HOURS = { "1d": 24, "7d": 168, "30d": 720 } as const;
