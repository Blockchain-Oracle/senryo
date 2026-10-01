/**
 * The raw error of a query, by key. A `Reading` only keeps a diagnosis; some Social states turn on the api's own
 * answer — 404 "not public on this network", 503 "board not computed yet" — so the screen reads the error itself,
 * subscribed to the query cache (never a one-off peek, which a memoising render would keep stale).
 */
import { useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

export function useQueryError(queryKey: readonly unknown[]): unknown {
  const client = useQueryClient();
  const read = () => client.getQueryState(queryKey)?.error ?? undefined;
  return useSyncExternalStore((onChange) => client.getQueryCache().subscribe(onChange), read, read);
}
