/** Timings of the query layer (ms unless stated). */

/** Cached data turns "stale" after this many missed refetch intervals (or on a failed refresh), never on TanStack's
 * `isStale` timer — that flipped every cycle and remounted screens (S8.16a). */
export const STALE_AFTER_INTERVALS = 2;

/** The wallet's dollar balance until S5 pushes it over the user's stream (D-272); send invalidations refresh sooner. */
export const ACCOUNT_REFETCH_MS = 10_000;
