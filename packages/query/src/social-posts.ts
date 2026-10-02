/**
 * Theses, replies, likes, reports, block / mute and "delete my data" hooks (S12b.6/8, D-174, App Store 1.2).
 * Writes run through the app's `SessionRunner`; errors keep their API code (NOT_LISTED, CONTENT_BLOCKED, BLOCKED,
 * RATE_LIMITED, …) so screens map them to copy. Every write invalidates the network's social reads it can change.
 */
import {
  type Address,
  blockRoute,
  blocksRoute,
  likeRoute,
  muteRoute,
  mutesRoute,
  type PostCreate,
  postCreateRoute,
  postDeleteRoute,
  postReportRoute,
  profileReportRoute,
  type ReportRequest,
  socialDeleteRoute,
  threadRoute,
  tradeAnchorRoute,
  unblockRoute,
  unlikeRoute,
  unmuteRoute,
} from "@senryo/api-client";
import { fromQuery } from "@senryo/core";
import { PositionsDocument, positionsVars } from "@senryo/indexer-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryEnv } from "./env.tsx";
import { type SessionRunner, socialKeys } from "./social.ts";

export const THREAD_STALE_MS = 15_000;
export const RELATIONS_STALE_MS = 60_000;

const run = <T>(session: SessionRunner | undefined, work: () => Promise<T>): Promise<T> =>
  session ? session(work) : Promise.reject(new Error("sign in first (no API session)"));

/** One invalidation for everything social on the active network (feed, threads, boards, profiles). */
function useSocialRefresh() {
  const env = useQueryEnv();
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: socialKeys.chain(env.chainId) });
}

/** Open positions a thesis may attach (F4 step 5): their indexer ids are what `positionId` names. */
const ATTACHABLE_POSITIONS = 20;

/** The account's indexed open positions on the active network, newest first (compose's "attach my position"). */
export function useAttachablePositions(address: Address | undefined) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: ["social", env.chainId, "attachable", (address ?? "0x").toLowerCase()] as const,
    queryFn: ({ signal }) =>
      env.indexer.request(
        PositionsDocument,
        positionsVars(
          { chainId: env.chainId, user: address ?? "0x" },
          { status: ["OPEN"], limit: ATTACHABLE_POSITIONS },
        ),
        signal,
      ),
    enabled: address !== undefined,
    staleTime: THREAD_STALE_MS,
  });
  return fromQuery(query);
}

/** A thesis with its replies (oldest first). A hidden / deleted post or an unlisted author reads as `failed` (404). */
export function useThread(id: string | undefined) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: socialKeys.thread(env.chainId, id ?? ""),
    queryFn: ({ signal }) =>
      env.api.call(threadRoute, { params: { id: id ?? "" }, query: { chainId: env.chainId } }, { signal }),
    enabled: id !== undefined,
    staleTime: THREAD_STALE_MS,
    retry: false,
  });
  return fromQuery(query);
}

/** Compose a thesis or a reply on the active network. */
export function useCreatePost(session: SessionRunner | undefined) {
  const env = useQueryEnv();
  const refresh = useSocialRefresh();
  return useMutation({
    mutationFn: (post: Omit<PostCreate, "chainId">) =>
      run(session, () => env.api.call(postCreateRoute, { body: { ...post, chainId: env.chainId } as PostCreate })),
    onSuccess: refresh,
  });
}

export function useDeletePost(session: SessionRunner | undefined) {
  const env = useQueryEnv();
  const refresh = useSocialRefresh();
  return useMutation({
    mutationFn: (id: string) => run(session, () => env.api.call(postDeleteRoute, { params: { id } })),
    onSuccess: refresh,
  });
}

/** What a like, reply, report or share acts on: a post, or a feed trade row whose post may not exist yet (F-D1). */
export type PostTarget = { post: string } | { tradeRow: string };

/** F-D1: a trade row's post, created on first use (idempotent); its id is what likes, replies and links use. */
export function useTradePost() {
  const env = useQueryEnv();
  return useMutation({
    mutationFn: (tradeRow: string) => env.api.call(tradeAnchorRoute, { params: { id: tradeRow } }),
  });
}

/** Like / unlike; the answer carries the new count for an optimistic row update. A trade row gets its post first. */
export function useLikeToggle(session: SessionRunner | undefined) {
  const env = useQueryEnv();
  const refresh = useSocialRefresh();
  return useMutation({
    mutationFn: ({ target, like }: { target: PostTarget; like: boolean }) =>
      run(session, async () => {
        const id =
          "post" in target
            ? target.post
            : (await env.api.call(tradeAnchorRoute, { params: { id: target.tradeRow } })).id;
        return env.api.call(like ? likeRoute : unlikeRoute, { params: { id } });
      }),
    onSuccess: refresh,
  });
}

/** Report a post or a profile. The reported post disappears from the reporter's feed at once. */
export function useReport(session: SessionRunner | undefined) {
  const env = useQueryEnv();
  const refresh = useSocialRefresh();
  return useMutation({
    mutationFn: (input: ({ post: string } | { profile: Address }) & ReportRequest) => {
      const body: ReportRequest = { reason: input.reason, ...(input.note ? { note: input.note } : {}) };
      return run(session, () =>
        "post" in input
          ? env.api.call(postReportRoute, { params: { id: input.post }, body })
          : env.api.call(profileReportRoute, { params: { address: input.profile }, body }),
      );
    },
    onSuccess: refresh,
  });
}

/** Block / unblock (removes follows both ways) — or mute / unmute (your feed only). */
export function useRelationToggle(kind: "blocks" | "mutes", session: SessionRunner | undefined) {
  const env = useQueryEnv();
  const client = useQueryClient();
  const refresh = useSocialRefresh();
  return useMutation({
    mutationFn: ({ address, on }: { address: Address; on: boolean }) =>
      run(session, async () => {
        const params = { params: { address } };
        if (kind === "blocks") return (await env.api.call(on ? blockRoute : unblockRoute, params)).blocked;
        return (await env.api.call(on ? muteRoute : unmuteRoute, params)).muted;
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: socialKeys.relations(kind) });
      await refresh();
    },
  });
}

/** My blocks or mutes (handles shown only while the account is listed on the session's network). */
export function useRelations(kind: "blocks" | "mutes", session: SessionRunner | undefined) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: socialKeys.relations(kind),
    queryFn: async () =>
      (await run(session, () => env.api.call(kind === "blocks" ? blocksRoute : mutesRoute, { query: {} }))).items,
    enabled: session !== undefined,
    staleTime: RELATIONS_STALE_MS,
  });
  return fromQuery(query);
}

/**
 * "Delete my data" for the social layer: profile, follows, blocks, mutes, posts, likes, reports and feed rows. The
 * released handle stays held 30 days (`handleHeldUntil`) so nobody can impersonate by re-claiming it at once.
 */
export function useDeleteSocialData(session: SessionRunner | undefined) {
  const env = useQueryEnv();
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => run(session, () => env.api.call(socialDeleteRoute, {})),
    onSuccess: () => client.invalidateQueries({ queryKey: socialKeys.all }),
  });
}
