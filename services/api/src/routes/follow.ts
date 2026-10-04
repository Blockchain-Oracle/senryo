import {
  followersRoute,
  followGetRoute,
  followingRoute,
  followRoute,
  myFollowCountsRoute,
  myFollowListRoute,
  unfollowRoute,
} from "@senryo/api-client";
import { HTTP_STATUS, HttpError, type HttpServer, parseRoute, sendRoute } from "@senryo/service-common";
import { FOLLOW_READ_RATE, FOLLOW_WRITE_RATE } from "../social/constants.ts";
import { follow, followPage, followState, isListedOn, ownFollowCounts, unfollow } from "../social/follows.ts";
import { bestEffort, notifyFollowed } from "../social/notify.ts";
import { requireSession, type SocialContext } from "../social/shared.ts";

/**
 * Follows (S12b.3, D-174). Writes need a session; a block either way is 403 BLOCKED; the cap is FOLLOWING_MAX.
 * Lists answer 404 for an account not listed on the queried network and never show unlisted accounts. A follow
 * notifies the followed account ("@kai followed you", channel `social`).
 */
export function registerFollowRoutes(app: HttpServer, ctx: SocialContext): void {
  app.get(myFollowCountsRoute.path, { config: { rateLimit: FOLLOW_READ_RATE } }, async (request, reply) => {
    const s = await requireSession(ctx, request);
    const { query } = parseRoute(myFollowCountsRoute, request);
    if (query.chainId !== s.chainId)
      throw new HttpError(HTTP_STATUS.forbidden, "FORBIDDEN", "session is for another network");
    return sendRoute(reply, myFollowCountsRoute, await ownFollowCounts(ctx.db, s.chainId, s.address.toLowerCase()));
  });
  app.get(myFollowListRoute.path, { config: { rateLimit: FOLLOW_READ_RATE } }, async (request, reply) => {
    const s = await requireSession(ctx, request);
    const { params, query } = parseRoute(myFollowListRoute, request);
    if (query.chainId !== s.chainId)
      throw new HttpError(HTTP_STATUS.forbidden, "FORBIDDEN", "session is for another network");
    return sendRoute(
      reply,
      myFollowListRoute,
      await followPage(ctx.db, s.chainId, s.address.toLowerCase(), params.direction, query.cursor, query.limit),
    );
  });
  app.get(followGetRoute.path, { config: { rateLimit: FOLLOW_READ_RATE } }, async (request, reply) => {
    const s = await requireSession(ctx, request);
    const { params } = parseRoute(followGetRoute, request);
    const state = await followState(ctx.db, s.chainId, s.address.toLowerCase(), params.address.toLowerCase());
    return sendRoute(reply, followGetRoute, state);
  });

  app.post(followRoute.path, { config: { rateLimit: FOLLOW_WRITE_RATE } }, async (request, reply) => {
    const s = await requireSession(ctx, request);
    const { params } = parseRoute(followRoute, request);
    const me = s.address.toLowerCase();
    const target = params.address.toLowerCase();
    await follow(ctx.db, me, target);
    await bestEffort(request.log, "follow", () => notifyFollowed(ctx.db, s.chainId, me, target));
    return sendRoute(reply, followRoute, await followState(ctx.db, s.chainId, me, target));
  });

  app.delete(unfollowRoute.path, { config: { rateLimit: FOLLOW_WRITE_RATE } }, async (request, reply) => {
    const s = await requireSession(ctx, request);
    const { params } = parseRoute(unfollowRoute, request);
    const me = s.address.toLowerCase();
    const target = params.address.toLowerCase();
    await unfollow(ctx.db, me, target);
    return sendRoute(reply, unfollowRoute, await followState(ctx.db, s.chainId, me, target));
  });

  for (const [route, direction] of [
    [followersRoute, "followers"],
    [followingRoute, "following"],
  ] as const) {
    app.get(route.path, { config: { rateLimit: FOLLOW_READ_RATE } }, async (request, reply) => {
      const { params, query } = parseRoute(route, request);
      const address = params.address.toLowerCase();
      if (!(await isListedOn(ctx.db, query.chainId, address))) {
        throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", "no public profile on this network");
      }
      const page = await followPage(ctx.db, query.chainId, address, direction, query.cursor, query.limit);
      return sendRoute(reply, route, page);
    });
  }
}
