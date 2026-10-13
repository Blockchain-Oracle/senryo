/**
 * A pasted id (R6.6, D-338): what of ours a hash or number names, on the active network. Asked only for a complete id
 * (the caller decides — `pastedId` in `@senryo/search`); a found id doesn't change, so it stays fresh a while.
 */
import { type LookupHit, lookupRoute } from "@senryo/api-client";
import type { ChainId } from "@senryo/config";
import { fromQuery, type Reading } from "@senryo/core";
import { useQuery } from "@tanstack/react-query";
import { useQueryEnv } from "./env.tsx";

export const LOOKUP_STALE_MS = 60_000;

export const lookupKeys = {
  all: ["lookup"] as const,
  q: (chainId: ChainId, q: string) => ["lookup", chainId, q.toLowerCase()] as const,
};

export function useLookup(q: string | null): Reading<LookupHit[]> {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: lookupKeys.q(env.chainId, q ?? ""),
    queryFn: async ({ signal }) =>
      (await env.api.call(lookupRoute, { query: { chainId: env.chainId, q: q ?? "" } }, { signal })).hits,
    enabled: q !== null && q !== "",
    staleTime: LOOKUP_STALE_MS,
    retry: 1,
  });
  return fromQuery(query);
}
