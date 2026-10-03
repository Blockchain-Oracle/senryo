/**
 * Wallet movements for Activity (B12, D8): tokens and MON received from anyone, sent anywhere and swapped anywhere —
 * the api's `/v1/activity/wallet`, one item per transaction, newest first, a page at a time by its own cursor. The key
 * sits under the account key, so a finalized operation's account invalidation refreshes it; while the screen is open
 * it re-reads at the api's rescan pace, so money that arrives from outside appears without any action.
 */
import { WALLET_ACTIVITY_PAGE, type WalletActivityItem, walletActivityRoute } from "@senryo/api-client";
import type { Address } from "@senryo/core";
import { keys, useQueryEnv } from "@senryo/query";
import { useInfiniteQuery } from "@tanstack/react-query";

/** The api rescans an address at most once a minute; reading twice as often shows a new movement within one scan. */
const WALLET_REFETCH_MS = 30_000;

export function useWalletActivity(address: Address | undefined, enabled: boolean) {
  const env = useQueryEnv();
  const query = useInfiniteQuery({
    queryKey: [...keys.account(env.chainId, address ?? "0x"), "wallet-activity"] as const,
    queryFn: ({ pageParam, signal }) =>
      env.api.call(
        walletActivityRoute,
        {
          query: {
            chainId: env.chainId,
            address: address as Address,
            limit: WALLET_ACTIVITY_PAGE,
            ...(pageParam ? { before: pageParam } : {}),
          },
        },
        { signal },
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next ?? undefined,
    enabled: enabled && address !== undefined,
    staleTime: WALLET_REFETCH_MS,
    refetchInterval: WALLET_REFETCH_MS,
  });
  const items: WalletActivityItem[] | undefined = query.data?.pages.flatMap((p) => p.items);
  return {
    items,
    /** The wallet source can't be read: Activity goes on without it (the indexer and the journal still show). */
    failed: query.isError && query.data === undefined,
    hasMore: query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
    refetch: () => query.refetch(),
  };
}
