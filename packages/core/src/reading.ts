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
  | "perpl-down"
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
  isStale: boolean;
  error: unknown;
}

function diagnose(error: unknown): Diagnosis {
  if (error instanceof Error) return { kind: "unknown", technical: `${error.name}: ${error.message}` };
  return { kind: "unknown" };
}

/** Maps a query to a Reading: cached data survives a failed refresh as `stale`, never as an error or a zero. */
export function fromQuery<T>(query: QueryLike<T>): Reading<T> {
  if (query.data === undefined) {
    return query.isError ? { status: "failed", error: diagnose(query.error) } : unknownReading;
  }
  if (query.isError || query.isStale) {
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
