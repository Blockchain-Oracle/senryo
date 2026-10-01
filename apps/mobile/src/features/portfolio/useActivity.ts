/**
 * The account's activity feed (Activity history, direction's screen inventory): indexed rows for this network, newest
 * first, loaded a page at a time by keyset (the last row of a page is the cursor of the next, so nothing repeats or
 * goes missing inside a block). The document, its variables and its parser are `@senryo/indexer-client`'s; the key is
 * `keys.activity`, under the account key, so the engine socket's account invalidation refreshes it. Nothing is
 * derived here: a row is what the indexer wrote from an onchain event.
 */
import type { Address } from "@senryo/core";
import { fromQuery } from "@senryo/core";
import { ActivityDocument, type ActivityKind, activityVars, PAGE_SIZE } from "@senryo/indexer-client";
import { ACCOUNT_REFETCH_MS, keys, useQueryEnv } from "@senryo/query";
import { useInfiniteQuery } from "@tanstack/react-query";

interface Cursor {
  timestamp: number;
  id: string;
}

export function useActivity(address: Address | undefined, kinds?: readonly ActivityKind[]) {
  const env = useQueryEnv();
  const query = useInfiniteQuery({
    queryKey: [...keys.activity(env.chainId, address ?? "0x"), kinds?.join(",") ?? "all"] as const,
    queryFn: ({ pageParam, signal }) =>
      env.indexer.request(
        ActivityDocument,
        activityVars(
          { chainId: env.chainId, user: address ?? "0x" },
          { ...(pageParam ? { before: pageParam } : {}), ...(kinds ? { kinds } : {}) },
        ),
        signal,
      ),
    initialPageParam: undefined as Cursor | undefined,
    getNextPageParam: (last): Cursor | undefined => {
      const tail = last.at(-1);
      return tail && last.length >= PAGE_SIZE.activity ? { timestamp: tail.timestamp, id: tail.id } : undefined;
    },
    select: (data) => data.pages.flat(),
    enabled: address !== undefined,
    staleTime: ACCOUNT_REFETCH_MS,
  });
  return {
    reading: fromQuery(query),
    hasMore: query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
    refetch: () => query.refetch(),
  };
}
