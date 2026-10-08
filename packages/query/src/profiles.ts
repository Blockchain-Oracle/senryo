/**
 * Profile hooks (S12b.2–3, D-174): handle availability and profiles. Follows, the leaderboard and referral return
 * with S8. Public reads use the active network
 * (`env.chainId`) — a profile unlisted there answers 404 and reads as `failed`, never as a fabricated profile.
 * Session routes run through the app's `SessionRunner` (SIWE via the unlocked Mera session, `withSession` in the
 * apps), so this package never touches keys.
 */
import {
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
} from "@senryo/api-client";
import type { ChainId } from "@senryo/config";
import { type Address, fromQuery, type Reading } from "@senryo/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryEnv } from "./env.tsx";

/** Runs a session route with a valid API session (the app's `withSession(account, faceId, run)`). */
export type SessionRunner = <T>(run: () => Promise<T>) => Promise<T>;

/** A handle's state changes only when someone claims it; typing re-queries per keystroke (debounce in the screen). */
export const HANDLE_CHECK_STALE_MS = 10_000;
export const PROFILE_STALE_MS = 30_000;

export const socialKeys = {
  all: ["social"] as const,
  chain: (chainId: ChainId) => ["social", chainId] as const,
  handle: (handle: string) => ["social", "handle", handle] as const,
  me: (address: Address) => ["social", "me", address.toLowerCase()] as const,
  profile: (chainId: ChainId, key: string) => ["social", chainId, "profile", key.toLowerCase()] as const,
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

function noSession<T>(): Promise<T> {
  return Promise.reject(new Error("sign in first (no API session)"));
}
