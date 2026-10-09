import {
  cancelDuelRoute,
  type DuelView,
  duelLadderRoute,
  duelPickRoute,
  duelQueueRoute,
  duelRoute,
  duelsRoute,
  enterDuelRoute,
} from "@senryo/api-client";
import type { Address, Hex } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import type { DuelWithPicks, HttpServer } from "@senryo/service-common";
import { duelOf, duelsOf, HTTP_STATUS, HttpError, parseRoute, sendRoute } from "@senryo/service-common";
import type { ApiContext } from "../context.ts";
import { DUEL_REQUESTS_PER_MINUTE, DUELS_PAGE } from "../duel/constants.ts";
import { DuelReader } from "../history/duel-reader.ts";

/** Duel over HTTP (S8.6, D-294): enter and leave the queue, swipe, and read matches, ratings and the ladder. */
const MINUTE_MS = 60_000;
const limited = { config: { rateLimit: { max: DUEL_REQUESTS_PER_MINUTE, timeWindow: MINUTE_MS } } };
/** Before the reveal the deck stays sealed: neither its cards nor the server's seed are served. */
const SEALED = new Set(["opening", "sealed", "failed"]);

function duelsOn(ctx: ApiContext, chainId: ChainId) {
  const d = ctx.markets.get(chainId)?.duels;
  if (!d) throw new HttpError(HTTP_STATUS.unavailable, "NOT_DEPLOYED", `duels are not live on ${chainId}`);
  return d;
}

export function toDuelView(m: DuelWithPicks): DuelView {
  const sealed = SEALED.has(m.state);
  return {
    matchId: m.match_id as Hex,
    tier: m.tier,
    state: m.state as DuelView["state"],
    players: [m.player_a as Address, m.player_b as Address],
    keys: [m.key_a as Address | null, m.key_b as Address | null],
    pot: m.pot,
    cardStake: m.card_stake,
    deckHash: m.deck_hash as Hex,
    serverSeed: sealed ? null : (m.server_seed as Hex),
    cards: sealed ? [] : m.cards,
    pickDeadline: m.pick_deadline === null ? null : Number(m.pick_deadline),
    picks: m.picks.map((p) => ({
      card: p.card,
      seat: p.seat,
      player: p.player as Address,
      band: p.band,
      ticketId: p.ticket_id,
      returned: p.returned,
      result: p.result,
    })),
    winner: m.winner as Address | null,
    results: m.result_a === null || m.result_b === null ? null : [m.result_a, m.result_b],
    reason: m.reason,
    createdAt: m.created_at.toISOString(),
    updatedAt: m.updated_at.toISOString(),
  };
}

export function registerDuelRoutes(app: HttpServer, ctx: ApiContext): void {
  const reader = new DuelReader(ctx.db, ctx.env.INDEXER_SCHEMA);

  app.post(enterDuelRoute.path, limited, async (request, reply) => {
    const { body } = parseRoute(enterDuelRoute, request);
    const status = await duelsOn(ctx, body.chainId).queue.enter({ ...body, signature: body.signature as Hex });
    return sendRoute(reply, enterDuelRoute, status);
  });

  app.post(cancelDuelRoute.path, limited, async (request, reply) => {
    const { body } = parseRoute(cancelDuelRoute, request);
    return sendRoute(reply, cancelDuelRoute, await duelsOn(ctx, body.chainId).queue.cancel(body.owner, body.digest));
  });

  app.get(duelQueueRoute.path, async (request, reply) => {
    const { query } = parseRoute(duelQueueRoute, request);
    return sendRoute(reply, duelQueueRoute, { entry: await duelsOn(ctx, query.chainId).queue.latest(query.owner) });
  });

  app.post(duelPickRoute.path, limited, async (request, reply) => {
    const { body } = parseRoute(duelPickRoute, request);
    const d = duelsOn(ctx, body.chainId);
    const status = await d.relay.pick({ ...body, signature: body.signature as Hex }, (m, player) =>
      d.queue.seatKey(m.match_id as Hex, player),
    );
    return sendRoute(reply, duelPickRoute, status);
  });

  app.get(duelsRoute.path, async (request, reply) => {
    const { query } = parseRoute(duelsRoute, request);
    const [rows, rating] = await Promise.all([
      duelsOf(ctx.db, query.chainId, query.owner, DUELS_PAGE),
      reader.rating(query.chainId, query.owner).catch(() => undefined),
    ]);
    return sendRoute(reply, duelsRoute, { duels: rows.map(toDuelView), rating: rating ?? null });
  });

  app.get(duelRoute.path, async (request, reply) => {
    const { params, query } = parseRoute(duelRoute, request);
    const m = await duelOf(ctx.db, query.chainId, params.matchId);
    if (!m) throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", "no such duel");
    return sendRoute(reply, duelRoute, toDuelView(m));
  });

  app.get(duelLadderRoute.path, async (request, reply) => {
    const { query } = parseRoute(duelLadderRoute, request);
    const rows = await reader.ladder(query.chainId);
    return sendRoute(reply, duelLadderRoute, {
      players: rows.map((r) => ({ ...r, owner: r.owner as Address })),
    });
  });
}
