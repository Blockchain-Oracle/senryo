/**
 * `Reading<T>` — the cross-cutting state rule (plan §2.5): nothing renders a number without a value, so there is never
 * a fabricated $0.00. Owned here; apps render it with their states kits.
 *
 *   unknown → skeleton · fresh → value · stale → value + "Updated 14:02 · refreshing" · failed (no cache) → ErrorState
 */
export type DiagnosisKind =
  | "offline"
  | "rpc-down"
  | "api-down"
  | "indexer-lag"
  | "oracle-stale"
  | "not-deployed"
  | "unknown";

export interface Diagnosis {
  kind: DiagnosisKind;
  /** The technical line shown under "Technical details" (error name, status). Never a secret. */
  technical?: string;
}

export type Reading<T> =
  | { status: "unknown" }
  | { status: "fresh"; value: T; at: number }
  | { status: "stale"; value: T; at: number; refreshing: boolean; error?: Diagnosis }
  | { status: "failed"; error: Diagnosis };

export const unknownReading: Reading<never> = { status: "unknown" };

export function fresh<T>(value: T, at: number = Date.now()): Reading<T> {
  return { status: "fresh", value, at };
}

/** The subset of a TanStack Query result a Reading needs (kept structural so the query layer stays swappable). */
export interface QueryLike<T> {
  data: T | undefined;
  dataUpdatedAt: number;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * When cached data counts as stale. Deliberately NOT TanStack's `isStale`: with `staleTime == refetchInterval` it flips on
 * every refetch cycle, and a fresh↔stale flip remounted whole screens (the phone "keeps refreshing" bug, S8.16a).
 * Stale = the last refresh failed, or the data is older than the query's own budget (`staleAfterMs`, measured at `now`).
 */
export interface StaleBudget {
  now: number;
  staleAfterMs: number;
}

function diagnose(error: unknown): Diagnosis {
  if (error instanceof Error) return { kind: "unknown", technical: `${error.name}: ${error.message}` };
  return { kind: "unknown" };
}

/** Maps a query to a Reading: cached data survives a failed refresh as `stale`, never as an error or a zero. */
export function fromQuery<T>(query: QueryLike<T>, budget?: StaleBudget): Reading<T> {
  if (query.data === undefined) {
    return query.isError ? { status: "failed", error: diagnose(query.error) } : unknownReading;
  }
  const aged = budget !== undefined && budget.now - query.dataUpdatedAt > budget.staleAfterMs;
  if (query.isError || aged) {
    return {
      status: "stale",
      value: query.data,
      at: query.dataUpdatedAt,
      refreshing: query.isFetching,
      ...(query.isError ? { error: diagnose(query.error) } : {}),
    };
  }
  return { status: "fresh", value: query.data, at: query.dataUpdatedAt };
}
