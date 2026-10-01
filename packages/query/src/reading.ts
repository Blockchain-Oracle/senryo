/**
 * Every hook's Reading goes through here so "stale" means one thing app-wide (S8.16a): the last refresh failed, or the data
 * is older than STALE_AFTER_INTERVALS of the query's own refetch interval. Queries without an interval (calendar, geo)
 * turn stale only on a failed refresh.
 */
import { fromQuery, type QueryLike, type Reading } from "@senryo/core";
import { STALE_AFTER_INTERVALS } from "./constants.ts";

export function readingOf<T>(query: QueryLike<T>, refetchIntervalMs?: number): Reading<T> {
  if (refetchIntervalMs === undefined) return fromQuery(query);
  return fromQuery(query, { now: Date.now(), staleAfterMs: refetchIntervalMs * STALE_AFTER_INTERVALS });
}
