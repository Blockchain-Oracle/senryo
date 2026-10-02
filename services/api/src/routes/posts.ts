import {
  feedRoute,
  likeRoute,
  postCreateRoute,
  postDeleteRoute,
  postReportRoute,
  searchRoute,
  threadRoute,
  tradeAnchorRoute,
  unlikeRoute,
} from "@senryo/api-client";
import { HTTP_STATUS, HttpError, type HttpServer, parseRoute, sendRoute } from "@senryo/service-common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { POST_WRITE_RATE, REPORT_RATE, SEARCH_RATE, SOCIAL_READ_RATE } from "../social/constants.ts";
import { feedPage } from "../social/feed.ts";
import { bestEffort, notifyLiked, notifyReplied } from "../social/notify.ts";
import { createPost, deletePost, readPost, readThread, setLike } from "../social/posts.ts";
import { fileReport, reporterWeight } from "../social/reports.ts";
import type { SocialRuntime } from "../social/runtime.ts";
import { search } from "../social/search.ts";
import { optionalSession, requireSession } from "../social/shared.ts";
import { tradePost } from "../social/trade-posts.ts";

/**
 * Feed, theses/replies, likes, post reports and search (S12b.4/6/7, D-174). Reads take an optional session (viewer
 * filtering: blocks, mutes, reports, likes); writes need one. A new thesis emits a `feed:{chainId}` notice; a reply
 * and a like notify the author (channel `social`). A trade row's post (F-D1) is created on first use by anyone who can
 * see the row — a guest's share link needs it too — and is idempotent, so it is rate-limited like a write.
 */
export function registerPostRoutes(app: HttpServer, ctx: SocialRuntime): void {
  const viewerOf = async (request: FastifyRequest) =>
    (await optionalSession(ctx, request))?.address.toLowerCase() ?? null;

  app.get(feedRoute.path, { config: { rateLimit: SOCIAL_READ_RATE } }, async (request, reply) => {
    const { query } = parseRoute(feedRoute, request);
    return sendRoute(reply, feedRoute, await feedPage(ctx.db, query, await viewerOf(request)));
  });

  app.get(searchRoute.path, { config: { rateLimit: SEARCH_RATE } }, async (request, reply) => {
    const { query } = parseRoute(searchRoute, request);
    const result = await search(ctx.db, query.chainId, query.q, query.kind, await viewerOf(request));
    return sendRoute(reply, searchRoute, result);
  });

  app.post(postCreateRoute.path, { config: { rateLimit: POST_WRITE_RATE } }, async (request, reply) => {
    const s = await requireSession(ctx, request);
    const { body } = parseRoute(postCreateRoute, request);
    const { post, feedId } = await createPost(ctx.db, ctx.social.indexer, s.address.toLowerCase(), body);
    if (feedId !== null) ctx.social.notifier.emit(body.chainId, feedId);
    if (post.kind === "reply")
      await bestEffort(request.log, "reply", () => notifyReplied(ctx.db, post.chainId, post.id));
    return sendRoute(reply, postCreateRoute, post);
  });

  app.post(tradeAnchorRoute.path, { config: { rateLimit: POST_WRITE_RATE } }, async (request, reply) => {
    const { params } = parseRoute(tradeAnchorRoute, request);
    const viewer = await viewerOf(request);
    const post = await tradePost(ctx.db, BigInt(params.id), (chainId, id) => readPost(ctx.db, chainId, id, viewer));
    return sendRoute(reply, tradeAnchorRoute, post);
  });

  app.get(threadRoute.path, { config: { rateLimit: SOCIAL_READ_RATE } }, async (request, reply) => {
    const { params, query } = parseRoute(threadRoute, request);
    const thread = await readThread(
      ctx.db,
      query.chainId,
      params.id,
      await viewerOf(request),
      query.cursor,
      query.limit,
    );
    if (!thread) throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", "no such post on this network");
    return sendRoute(reply, threadRoute, thread);
  });

  app.delete(postDeleteRoute.path, { config: { rateLimit: POST_WRITE_RATE } }, async (request, reply) => {
    const s = await requireSession(ctx, request);
    const { params } = parseRoute(postDeleteRoute, request);
    return sendRoute(reply, postDeleteRoute, { deleted: await deletePost(ctx.db, s.address.toLowerCase(), params.id) });
  });

  const like =
    (route: typeof likeRoute | typeof unlikeRoute, liked: boolean) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      const s = await requireSession(ctx, request);
      const { params } = parseRoute(route, request);
      // Likes act on the session's network (the app's active mode).
      const me = s.address.toLowerCase();
      const state = await setLike(ctx.db, s.chainId, me, params.id, liked);
      if (liked) await bestEffort(request.log, "like", () => notifyLiked(ctx.db, s.chainId, me, params.id));
      return sendRoute(reply, route, state);
    };
  app.post(likeRoute.path, { config: { rateLimit: POST_WRITE_RATE } }, like(likeRoute, true));
  app.delete(unlikeRoute.path, { config: { rateLimit: POST_WRITE_RATE } }, like(unlikeRoute, false));

  app.post(postReportRoute.path, { config: { rateLimit: REPORT_RATE } }, async (request, reply) => {
    const s = await requireSession(ctx, request);
    const { params, body } = parseRoute(postReportRoute, request);
    const reporter = s.address.toLowerCase();
    const weight = await reporterWeight(ctx.db, ctx.social.indexer, ctx.social.chainIds, reporter);
    // One canonical id per target (lower-case uuid text), so weights never split across spellings.
    const postId = params.id.toLowerCase();
    await fileReport(ctx.db, weight, reporter, "post", postId, body);
    return sendRoute(reply, postReportRoute, { targetKind: "post", targetId: postId, reported: true });
  });
}
