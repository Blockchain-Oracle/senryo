import {
  arcadeBoardRoute,
  arcadeScoreRoute,
  arcadeSeedRoute,
  luckyDrawsRoute,
  luckyPlacedRoute,
  luckyRevealRoute,
  luckySealRoute,
} from "@senryo/api-client";
import type { Address, Hex } from "@senryo/chain";
import type { LuckySide } from "@senryo/core";
import {
  HTTP_STATUS,
  HttpError,
  type HttpServer,
  linkLuckyTicket,
  luckyDrawsOf,
  parseRoute,
  sendRoute,
} from "@senryo/service-common";
import type { ApiContext } from "../context.ts";
import { ArcadeDesk } from "../games/arcade.ts";
import { LuckyDesk } from "../games/lucky.ts";

/** Lucky and the arcade over HTTP (S8.8, D-295): signed-in seals, reveals, seeds and scores; public draws and boards. */
const MINUTE_MS = 60_000;
const SPINS_PER_MINUTE = 20;
const RUNS_PER_MINUTE = 30;
const DRAWS_PAGE = 30;

async function sessionOf(ctx: ApiContext, request: Parameters<NonNullable<ApiContext["sessions"]>["require"]>[0]) {
  const session = await ctx.sessions?.require(request);
  if (!session) throw new HttpError(HTTP_STATUS.unavailable, "NOT_DEPLOYED", "sessions not configured");
  return session;
}

export function registerGameRoutes(app: HttpServer, ctx: ApiContext): void {
  const arcade = new ArcadeDesk(ctx.db);
  const lucky = (chainId: Parameters<typeof luckyDrawsOf>[1]) =>
    new LuckyDesk({ chainId, gateway: ctx.gateway, db: ctx.db });
  const spins = { config: { rateLimit: { max: SPINS_PER_MINUTE, timeWindow: MINUTE_MS } } };
  const runs = { config: { rateLimit: { max: RUNS_PER_MINUTE, timeWindow: MINUTE_MS } } };

  app.post(luckySealRoute.path, spins, async (request, reply) => {
    const session = await sessionOf(ctx, request);
    return sendRoute(reply, luckySealRoute, await lucky(session.chainId).seal(session.address as Address));
  });

  app.post(luckyRevealRoute.path, spins, async (request, reply) => {
    const session = await sessionOf(ctx, request);
    const { body } = parseRoute(luckyRevealRoute, request);
    const r = await lucky(session.chainId).reveal(body.drawId, session.address as Address, body.clientSeed);
    return sendRoute(reply, luckyRevealRoute, {
      ...r,
      dealt: r.dealt ? { ...r.dealt, windowId: r.dealt.windowId as Hex, priceE6: BigInt(r.dealt.priceE6) } : null,
    });
  });

  app.post(luckyPlacedRoute.path, spins, async (request, reply) => {
    const session = await sessionOf(ctx, request);
    const { body } = parseRoute(luckyPlacedRoute, request);
    await linkLuckyTicket(ctx.db, session.chainId, body.drawId, session.address, body.ticketId);
    return sendRoute(reply, luckyPlacedRoute, { ok: true });
  });

  app.get(luckyDrawsRoute.path, async (request, reply) => {
    const { query } = parseRoute(luckyDrawsRoute, request);
    const rows = await luckyDrawsOf(ctx.db, query.chainId, query.owner, DRAWS_PAGE);
    return sendRoute(reply, luckyDrawsRoute, {
      draws: rows.map((d) => ({
        drawId: d.draw_id,
        owner: d.owner as Address,
        commitment: d.commitment as Hex,
        markets: d.markets,
        marketsHash: d.markets_hash as Hex,
        serverSeed: d.server_seed as Hex,
        clientSeed: d.client_seed as Hex,
        digest: d.digest as Hex,
        symbol: d.symbol ?? "",
        side: (d.side ?? "up") as LuckySide,
        reach: d.reach ?? 0,
        dealt: d.dealt ? { ...d.dealt, windowId: d.dealt.windowId as Hex, priceE6: BigInt(d.dealt.priceE6) } : null,
        ticketId: d.ticket_id,
        sealedAt: d.sealed_at.toISOString(),
      })),
    });
  });

  app.post(arcadeSeedRoute.path, runs, async (request, reply) => {
    const session = await sessionOf(ctx, request);
    const { body } = parseRoute(arcadeSeedRoute, request);
    return sendRoute(reply, arcadeSeedRoute, { seed: await arcade.seed(session.address as Address, body.game) });
  });

  app.post(arcadeScoreRoute.path, runs, async (request, reply) => {
    const session = await sessionOf(ctx, request);
    const { body } = parseRoute(arcadeScoreRoute, request);
    return sendRoute(reply, arcadeScoreRoute, await arcade.submit(session.address as Address, body));
  });

  app.get(arcadeBoardRoute.path, async (request, reply) => {
    const { query } = parseRoute(arcadeBoardRoute, request);
    const rows = await arcade.board(query.game);
    return sendRoute(reply, arcadeBoardRoute, {
      players: rows.map((r) => ({
        owner: r.owner as Address,
        handle: r.handle,
        score: r.score,
        calm: r.calm,
        at: r.created_at.toISOString(),
      })),
    });
  });
}
