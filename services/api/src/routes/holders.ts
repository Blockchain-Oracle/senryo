import { marketHoldersRoute } from "@senryo/api-client";
import { engineMarketsOn } from "@senryo/config";
import { HTTP_STATUS, HttpError, type HttpServer, parseRoute, sendRoute } from "@senryo/service-common";
import { SOCIAL_READ_RATE } from "../social/constants.ts";
import type { SocialRuntime } from "../social/runtime.ts";
import { optionalSession } from "../social/shared.ts";

/**
 * Market Holders (FT098): a market detail tab. Public with an optional session (blocks, mutes and the Friends filter
 * are the viewer's); the market must be one SenryoCore lists on that network.
 */
export function registerHolderRoutes(app: HttpServer, ctx: SocialRuntime): void {
  app.get(marketHoldersRoute.path, { config: { rateLimit: SOCIAL_READ_RATE } }, async (request, reply) => {
    const { params, query } = parseRoute(marketHoldersRoute, request);
    if (!engineMarketsOn(query.chainId).some((m) => m.id === params.marketId)) {
      throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", "no such market on this network");
    }
    const viewer = (await optionalSession(ctx, request))?.address.toLowerCase() ?? null;
    const page = await ctx.social.holders.page(query.chainId, params.marketId, viewer, query.friends);
    return sendRoute(reply, marketHoldersRoute, page);
  });
}
