/**
 * Feed, leaderboard, Top Trades, follow recommendations and search hooks (S12b.4/5/7, D-174). Reads use the active
 * network (`env.chainId`); routes with `auth: "optional"` carry the session token when the app has one (blocks, mutes,
 * likes, "Your rank") without ever prompting. A leaderboard that isn't computed yet (503) reads as `failed`, never
 * as an empty board; "Not ranked" is `you.rank === null`, never 0.
 */
import {
  type FeedItem,
  type FeedScope,
  feedRoute,
  type LeaderboardPeriod,
  type LeaderboardScope,
  leaderboardRoute,
  recommendationsRoute,
  type SearchKind,
  searchRoute,
  topTradesRoute,
} from "@senryo/api-client";
import { fromQuery } from "@senryo/core";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useQueryEnv } from "./env.tsx";
import { type SessionRunner, socialKeys } from "./social.ts";

/** The api refreshes snapshots every 60 s; the feed is pushed ("New activity") so it only needs a slow fallback. */
export const LEADERBOARD_STALE_MS = 60_000;
export const FEED_STALE_MS = 30_000;
export const SEARCH_STALE_MS = 30_000;
/** Typing re-queries per keystroke (debounce in the screen); one character is never sent. */
export const SEARCH_MIN_CHARS = 2;

/** The feed of the active network, newest first, page by page. `market` = the market detail Feed tab. */
export function useFeed(scope: FeedScope = "global", market?: string) {
  const env = useQueryEnv();
  const query = useInfiniteQuery({
    queryKey: socialKeys.feed(env.chainId, scope, market),
    queryFn: ({ pageParam, signal }) =>
      env.api.call(
        feedRoute,
        {
          query: {
            chainId: env.chainId,
            scope,
            ...(market ? { market } : {}),
            ...(pageParam ? { cursor: pageParam } : {}),
          },
        },
        { signal },
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    select: (data): FeedItem[] => data.pages.flatMap((page) => page.items),
    staleTime: FEED_STALE_MS,
  });
  return {
    reading: fromQuery(query),
    hasMore: query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
  };
}

/**
 * "New activity" pill: true once the socket reports a feed row newer than `topId` (the first loaded item).
 * `show()` refetches the feed from the top and clears the pill.
 */
export function useFeedActivity(topId: string | undefined, scope: FeedScope = "global", market?: string) {
  const env = useQueryEnv();
  const client = useQueryClient();
  const [latest, setLatest] = useState<string | undefined>(undefined);
  useEffect(() => env.socket.onFeed(setLatest), [env.socket]);
  const fresh = latest !== undefined && (topId === undefined || BigInt(latest) > BigInt(topId));
  const show = useCallback(async () => {
    setLatest(undefined);
    await client.resetQueries({ queryKey: socialKeys.feed(env.chainId, scope, market) });
  }, [client, env.chainId, scope, market]);
  return { hasNew: fresh, show };
}

export function useLeaderboard(period: LeaderboardPeriod, scope: LeaderboardScope = "all") {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: socialKeys.leaderboard(env.chainId, period, scope),
    queryFn: ({ signal }) =>
      env.api.call(leaderboardRoute, { query: { chainId: env.chainId, period, scope } }, { signal }),
    staleTime: LEADERBOARD_STALE_MS,
    refetchInterval: LEADERBOARD_STALE_MS,
  });
  return fromQuery(query);
}

/** Weekly verified Top Trades of the active network. */
export function useTopTrades() {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: socialKeys.topTrades(env.chainId),
    queryFn: ({ signal }) => env.api.call(topTradesRoute, { query: { chainId: env.chainId } }, { signal }),
    staleTime: LEADERBOARD_STALE_MS,
  });
  return fromQuery(query);
}

/** "Follow top traders" (onboarding): the 30d ranked floor; the screen preselects none and shows each `reason`. */
export function useFollowRecommendations(session: SessionRunner | undefined) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: socialKeys.recommendations(env.chainId),
    queryFn: () =>
      (session ?? noSession)(() => env.api.call(recommendationsRoute, { query: { chainId: env.chainId } })),
    enabled: session !== undefined,
    staleTime: LEADERBOARD_STALE_MS,
  });
  return fromQuery(query);
}

/** Global search (All / Markets / Tokens / Traders); recents are kept by the screen. */
export function useSearch(q: string, kind?: SearchKind) {
  const env = useQueryEnv();
  const text = q.trim();
  const query = useQuery({
    queryKey: socialKeys.search(env.chainId, text, kind),
    queryFn: ({ signal }) =>
      env.api.call(searchRoute, { query: { chainId: env.chainId, q: text, ...(kind ? { kind } : {}) } }, { signal }),
    enabled: text.length >= SEARCH_MIN_CHARS,
    staleTime: SEARCH_STALE_MS,
  });
  return fromQuery(query);
}

function noSession<T>(): Promise<T> {
  return Promise.reject(new Error("sign in first (no API session)"));
}
