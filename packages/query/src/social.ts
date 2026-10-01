/**
 * Social hooks (S12b.2–3, D-174): handle availability, profiles, follows. Public reads use the active network
 * (`env.chainId`) — a profile unlisted there answers 404 and reads as `failed`, never as a fabricated profile.
 * Session routes run through the app's `SessionRunner` (SIWE via the unlocked Mera session, `withSession` in the
 * apps), so this package never touches keys.
 */
import {
  type FollowEntry,
  type FollowState,
  followersRoute,
  followGetRoute,
  followingRoute,
  followRoute,
  type HandleAvailability,
  handleAvailableRoute,
  handleSyntaxIssue,
  type MyProfile,
  myProfileRoute,
  normalizeHandle,
  type ProfileUpdate,
  type PublicProfile,
  profileGetRoute,
  profilePutRoute,
  unfollowRoute,
} from "@senryo/api-client";
import type { ChainId } from "@senryo/config";
import { type Address, fromQuery, type Reading } from "@senryo/core";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryEnv } from "./env.tsx";

/** Runs a session route with a valid API session (the app's `withSession(account, faceId, run)`). */
export type SessionRunner = <T>(run: () => Promise<T>) => Promise<T>;

/** A handle's state changes only when someone claims it; typing re-queries per keystroke (debounce in the screen). */
export const HANDLE_CHECK_STALE_MS = 10_000;
export const PROFILE_STALE_MS = 30_000;
export const FOLLOW_STALE_MS = 30_000;

export const socialKeys = {
  all: ["social"] as const,
  chain: (chainId: ChainId) => ["social", chainId] as const,
  handle: (handle: string) => ["social", "handle", handle] as const,
  me: (address: Address) => ["social", "me", address.toLowerCase()] as const,
  profile: (chainId: ChainId, key: string) => ["social", chainId, "profile", key.toLowerCase()] as const,
  follow: (chainId: ChainId, me: Address, other: Address) =>
    ["social", chainId, "follow", me.toLowerCase(), other.toLowerCase()] as const,
  list: (chainId: ChainId, direction: "followers" | "following", address: Address) =>
    ["social", chainId, direction, address.toLowerCase()] as const,
  /** S12b.4–8 */
  feed: (chainId: ChainId, scope: string, market: string | undefined) =>
    ["social", chainId, "feed", scope, market ?? "all"] as const,
  thread: (chainId: ChainId, id: string) => ["social", chainId, "thread", id] as const,
  leaderboard: (chainId: ChainId, period: string, scope: string) =>
    ["social", chainId, "leaderboard", period, scope] as const,
  topTrades: (chainId: ChainId) => ["social", chainId, "top-trades"] as const,
  recommendations: (chainId: ChainId) => ["social", chainId, "recommendations"] as const,
  search: (chainId: ChainId, q: string, kind: string | undefined) =>
    ["social", chainId, "search", q.trim().toLowerCase(), kind ?? "all"] as const,
  relations: (kind: "blocks" | "mutes") => ["social", "relations", kind] as const,
};

/** Availability of a typed handle. Syntax problems answer locally (no request); the server decides the rest. */
export function useHandleAvailability(input: string | undefined): Reading<HandleAvailability> {
  const env = useQueryEnv();
  const handle = normalizeHandle(input ?? "");
  const query = useQuery({
    queryKey: socialKeys.handle(handle),
    queryFn: async ({ signal }): Promise<HandleAvailability> => {
      const issue = handleSyntaxIssue(handle);
      if (issue) return { handle, state: "invalid", reason: issue, heldUntil: null };
      return env.api.call(handleAvailableRoute, { params: { h: handle } }, { signal });
    },
    enabled: handle !== "",
    staleTime: HANDLE_CHECK_STALE_MS,
  });
  return fromQuery(query);
}

/** The signed-in account's own profile with every per-network setting (`null` before the first save). */
export function useMyProfile(address: Address | undefined, session: SessionRunner | undefined) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: socialKeys.me(address ?? "0x"),
    queryFn: async (): Promise<MyProfile | null> =>
      (await (session ?? noSession)(() => env.api.call(myProfileRoute, {}))).profile,
    enabled: address !== undefined && session !== undefined,
    staleTime: PROFILE_STALE_MS,
  });
  return fromQuery(query);
}

/** Save the profile (claims/changes the handle). Errors keep their API code: HANDLE_TAKEN, HANDLE_HELD, … */
export function useSaveProfile(address: Address | undefined, session: SessionRunner | undefined) {
  const env = useQueryEnv();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (update: ProfileUpdate) =>
      (session ?? noSession)(() => env.api.call(profilePutRoute, { body: update })),
    onSuccess: async (saved) => {
      if (address) client.setQueryData(socialKeys.me(address), saved);
      // Listing and handle changes show on both networks' profile pages and lists.
      await client.invalidateQueries({ queryKey: socialKeys.all, predicate: (q) => q.queryKey[1] !== "me" });
    },
  });
}

/** A public profile by `@handle` or address on the active network. */
export function useProfile(handleOrAddress: string | undefined): Reading<PublicProfile> {
  const env = useQueryEnv();
  const key = handleOrAddress ?? "";
  const query = useQuery({
    queryKey: socialKeys.profile(env.chainId, key),
    queryFn: ({ signal }) =>
      env.api.call(profileGetRoute, { params: { handleOrAddress: key }, query: { chainId: env.chainId } }, { signal }),
    enabled: key !== "",
    staleTime: PROFILE_STALE_MS,
    retry: false,
  });
  return fromQuery(query);
}

/** The session account's relationship with `other` (following, followsYou, blocked). */
export function useFollowState(
  me: Address | undefined,
  other: Address | undefined,
  session: SessionRunner | undefined,
): Reading<FollowState> {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: socialKeys.follow(env.chainId, me ?? "0x", other ?? "0x"),
    queryFn: () => (session ?? noSession)(() => env.api.call(followGetRoute, { params: { address: other ?? "0x" } })),
    enabled: me !== undefined && other !== undefined && session !== undefined && me !== other,
    staleTime: FOLLOW_STALE_MS,
  });
  return fromQuery(query);
}

/** Follow / unfollow `other`; BLOCKED and FOLLOW_LIMIT surface as ApiError codes. */
export function useFollowToggle(me: Address | undefined, session: SessionRunner | undefined) {
  const env = useQueryEnv();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ other, follow }: { other: Address; follow: boolean }) =>
      (session ?? noSession)(() => env.api.call(follow ? followRoute : unfollowRoute, { params: { address: other } })),
    onSuccess: async (state) => {
      if (me) client.setQueryData(socialKeys.follow(env.chainId, me, state.address), state);
      await client.invalidateQueries({ queryKey: socialKeys.chain(env.chainId) });
    },
  });
}

/** Followers or following of `address` on the active network, newest first, loaded page by page. */
export function useFollowList(address: Address | undefined, direction: "followers" | "following") {
  const env = useQueryEnv();
  const route = direction === "followers" ? followersRoute : followingRoute;
  const query = useInfiniteQuery({
    queryKey: socialKeys.list(env.chainId, direction, address ?? "0x"),
    queryFn: ({ pageParam, signal }) =>
      env.api.call(
        route,
        {
          params: { address: address ?? "0x" },
          query: { chainId: env.chainId, ...(pageParam ? { cursor: pageParam } : {}) },
        },
        { signal },
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    select: (data): FollowEntry[] => data.pages.flatMap((page) => page.items),
    enabled: address !== undefined,
    staleTime: FOLLOW_STALE_MS,
  });
  return {
    reading: fromQuery(query),
    hasMore: query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
  };
}

function noSession<T>(): Promise<T> {
  return Promise.reject(new Error("sign in first (no API session)"));
}
