/**
 * Notifications inbox hooks (G1, D7): the account's notifications on one network, newest first, page by page; the
 * unread count for the header bell; mark read. Every route is a session route, run through the app's `SessionRunner`
 * (`withSession` in the apps). The bell polls, so give `useUnreadCount` a runner that never prompts (an unlocked
 * session only) — a badge must not ask for Face ID every minute.
 */
import {
  type AppNotification,
  type NotificationsReadResult,
  notificationsListRoute,
  notificationsReadRoute,
} from "@senryo/api-client";
import type { ChainId } from "@senryo/config";
import { type Address, fromQuery, type Reading } from "@senryo/core";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryEnv } from "./env.tsx";
import type { SessionRunner } from "./profiles.ts";

/** A push arriving while the app is open is the usual refresh; this is the fallback. */
export const NOTIFICATIONS_STALE_MS = 30_000;
export const UNREAD_POLL_MS = 60_000;

export const notificationKeys = {
  all: (chainId: ChainId, address: Address) => ["notifications", chainId, address.toLowerCase()] as const,
  list: (chainId: ChainId, address: Address) => ["notifications", chainId, address.toLowerCase(), "list"] as const,
  unread: (chainId: ChainId, address: Address) => ["notifications", chainId, address.toLowerCase(), "unread"] as const,
};

function noSession<T>(): Promise<T> {
  return Promise.reject(new Error("sign in first (no API session)"));
}

/** The inbox of `address` on `chainId`, newest first; `unread` comes with every page (the latest wins). */
export function useNotifications(chainId: ChainId, address: Address | undefined, session: SessionRunner | undefined) {
  const env = useQueryEnv();
  const query = useInfiniteQuery({
    queryKey: notificationKeys.list(chainId, address ?? "0x"),
    queryFn: ({ pageParam, signal }) =>
      (session ?? noSession)(() =>
        env.api.call(
          notificationsListRoute,
          { query: { chainId, ...(pageParam ? { cursor: pageParam } : {}) } },
          { signal },
        ),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    select: (data): { items: AppNotification[]; unread: number } => ({
      items: data.pages.flatMap((page) => page.items),
      unread: data.pages.at(-1)?.unread ?? 0,
    }),
    enabled: address !== undefined && session !== undefined,
    staleTime: NOTIFICATIONS_STALE_MS,
  });
  return {
    reading: fromQuery(query),
    hasMore: query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
  };
}

/** Unread notifications on `chainId` for the bell badge (a count, not a dot). */
export function useUnreadCount(
  chainId: ChainId,
  address: Address | undefined,
  session: SessionRunner | undefined,
): Reading<number> {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: notificationKeys.unread(chainId, address ?? "0x"),
    queryFn: async ({ signal }) =>
      (
        await (session ?? noSession)(() =>
          env.api.call(notificationsListRoute, { query: { chainId, limit: 1 } }, { signal }),
        )
      ).unread,
    enabled: address !== undefined && session !== undefined,
    staleTime: NOTIFICATIONS_STALE_MS,
    refetchInterval: UNREAD_POLL_MS,
  });
  return fromQuery(query);
}

/** Mark ids read, or everything up to `before` (the newest `createdAt` on screen). Updates the badge at once. */
export function useMarkNotificationsRead(
  chainId: ChainId,
  address: Address | undefined,
  session: SessionRunner | undefined,
) {
  const env = useQueryEnv();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (which: { ids: string[] } | { before: string }): Promise<NotificationsReadResult> =>
      (session ?? noSession)(() => env.api.call(notificationsReadRoute, { body: { chainId, ...which } })),
    onSuccess: async (result) => {
      if (!address) return;
      client.setQueryData(notificationKeys.unread(chainId, address), result.unread);
      await client.invalidateQueries({ queryKey: notificationKeys.list(chainId, address) });
    },
  });
}
