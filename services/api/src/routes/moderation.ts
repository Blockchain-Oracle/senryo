import { createHash, timingSafeEqual } from "node:crypto";
import {
  blockRoute,
  blocksRoute,
  muteRoute,
  mutesRoute,
  profileReportRoute,
  reviewQueueRoute,
  reviewRoute,
  socialDeleteRoute,
  unblockRoute,
  unmuteRoute,
} from "@senryo/api-client";
import { HTTP_STATUS, HttpError, type HttpServer, parseRoute, sendRoute } from "@senryo/service-common";
import type { FastifyReply, FastifyRequest } from "fastify";
import {
  ADMIN_RATE,
  ADMIN_SECRET_MIN_BYTES,
  DELETE_DATA_RATE,
  RELATION_WRITE_RATE,
  REPORT_RATE,
  SOCIAL_READ_RATE,
} from "../social/constants.ts";
import { deleteSocialData } from "../social/delete-data.ts";
import { block, isBlocked, isMuted, mute, relationList, unblock, unmute } from "../social/relations.ts";
import { fileReport, type ModerationHooks, reporterWeight, review, reviewQueue } from "../social/reports.ts";
import type { SocialRuntime } from "../social/runtime.ts";
import { requireSession } from "../social/shared.ts";

/**
 * User safety (S12b.6/8, App Store 1.2): block / mute (private lists), report a profile, delete my social data, and
 * the operator's review queue behind `API_ADMIN_SECRET` (constant-time compare; 503 when unset or too short).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

const digest = (text: string): Buffer => createHash("sha256").update(text).digest();

function requireAdmin(ctx: SocialRuntime, request: FastifyRequest): void {
  const secret = ctx.social.adminSecret;
  if (!secret || Buffer.byteLength(secret) < ADMIN_SECRET_MIN_BYTES) {
    throw new HttpError(HTTP_STATUS.unavailable, "NOT_DEPLOYED", "moderation review is not configured");
  }
  const [scheme, token] = (request.headers.authorization ?? "").split(" ");
  if (scheme !== "Bearer" || !token || !timingSafeEqual(digest(token), digest(secret))) {
    throw new HttpError(HTTP_STATUS.unauthorized, "UNAUTHORIZED", "operator credentials required");
  }
}

export function registerModerationRoutes(app: HttpServer, ctx: SocialRuntime): void {
  const hooks: ModerationHooks = { onProfileHidden: (address) => ctx.social.leaderboard.forget(address) };

  const pairOf = async (route: typeof blockRoute | typeof muteRoute, request: FastifyRequest) => {
    const s = await requireSession(ctx, request);
    const { params } = parseRoute(route, request);
    return { me: s.address.toLowerCase(), other: params.address.toLowerCase(), address: params.address };
  };
  const blocking =
    (route: typeof blockRoute | typeof unblockRoute, act: typeof block) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { me, other, address } = await pairOf(route, request);
      await act(ctx.db, me, other);
      return sendRoute(reply, route, { address, blocked: await isBlocked(ctx.db, me, other) });
    };
  const muting =
    (route: typeof muteRoute | typeof unmuteRoute, act: typeof mute) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { me, other, address } = await pairOf(route, request);
      await act(ctx.db, me, other);
      return sendRoute(reply, route, { address, muted: await isMuted(ctx.db, me, other) });
    };
  const writes = { config: { rateLimit: RELATION_WRITE_RATE } };
  app.post(blockRoute.path, writes, blocking(blockRoute, block));
  app.delete(unblockRoute.path, writes, blocking(unblockRoute, unblock));
  app.post(muteRoute.path, writes, muting(muteRoute, mute));
  app.delete(unmuteRoute.path, writes, muting(unmuteRoute, unmute));

  for (const [route, kind] of [
    [blocksRoute, "blocks"],
    [mutesRoute, "mutes"],
  ] as const) {
    app.get(route.path, { config: { rateLimit: SOCIAL_READ_RATE } }, async (request, reply) => {
      const s = await requireSession(ctx, request);
      const { query } = parseRoute(route, request);
      const items = await relationList(ctx.db, kind, s.chainId, s.address.toLowerCase(), query.limit);
      return sendRoute(reply, route, { items });
    });
  }

  app.post(profileReportRoute.path, { config: { rateLimit: REPORT_RATE } }, async (request, reply) => {
    const s = await requireSession(ctx, request);
    const { params, body } = parseRoute(profileReportRoute, request);
    const reporter = s.address.toLowerCase();
    const target = params.address.toLowerCase();
    const weight = await reporterWeight(ctx.db, ctx.social.indexer, ctx.social.chainIds, reporter);
    await fileReport(ctx.db, weight, reporter, "profile", target, body, hooks);
    return sendRoute(reply, profileReportRoute, { targetKind: "profile", targetId: target, reported: true });
  });

  app.delete(socialDeleteRoute.path, { config: { rateLimit: DELETE_DATA_RATE } }, async (request, reply) => {
    const s = await requireSession(ctx, request);
    const address = s.address.toLowerCase();
    const result = await deleteSocialData(ctx.db, address);
    ctx.social.leaderboard.forget(address);
    return sendRoute(reply, socialDeleteRoute, result);
  });

  app.get(reviewQueueRoute.path, { config: { rateLimit: ADMIN_RATE } }, async (request, reply) => {
    requireAdmin(ctx, request);
    const { query } = parseRoute(reviewQueueRoute, request);
    return sendRoute(reply, reviewQueueRoute, { items: await reviewQueue(ctx.db, query.status) });
  });

  app.post(reviewRoute.path, { config: { rateLimit: ADMIN_RATE } }, async (request, reply) => {
    requireAdmin(ctx, request);
    const { body } = parseRoute(reviewRoute, request);
    const valid = body.targetKind === "post" ? UUID_RE.test(body.targetId) : ADDRESS_RE.test(body.targetId);
    if (!valid) throw new HttpError(HTTP_STATUS.badRequest, "BAD_REQUEST", `targetId is not a ${body.targetKind} id`);
    const result = await review(ctx.db, body.targetKind, body.targetId.toLowerCase(), body.decision, body.note, hooks);
    return sendRoute(reply, reviewRoute, result);
  });
}
