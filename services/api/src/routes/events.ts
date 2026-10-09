import {
  type CommitteeView,
  type EventView,
  eventBoardRoute,
  eventCallsRoute,
  eventDetailRoute,
  placeEventCallRoute,
} from "@senryo/api-client";
import type { Address, Hex } from "@senryo/chain";
import { type ChainId, EVENT_COMMITTEES } from "@senryo/config";
import {
  answersOf,
  type EventRow,
  eventBoard,
  eventById,
  eventCallsOf,
  HTTP_STATUS,
  HttpError,
  type HttpServer,
  parseRoute,
  sendRoute,
} from "@senryo/service-common";
import type { ApiContext } from "../context.ts";

/** Yes/no events over HTTP (S8.7, D-296): the board, one event with its committee's statements, calls, and a call. */
const MINUTE_MS = 60_000;
const CALLS_PER_MINUTE = 30;
const limited = { config: { rateLimit: { max: CALLS_PER_MINUTE, timeWindow: MINUTE_MS } } };
/** The board keeps a settled question six hours, so a caller sees how theirs ended. */
const RECENT_SEC = 21_600;
const BOARD_SIZE = 80;
const CALLS_PAGE = 50;

function eventsOn(ctx: ApiContext, chainId: ChainId) {
  const relay = ctx.markets.get(chainId)?.events;
  if (!relay) throw new HttpError(HTTP_STATUS.unavailable, "NOT_DEPLOYED", `events are not live on ${chainId}`);
  return relay;
}

function committeeOf(chainId: ChainId): CommitteeView | null {
  const c = EVENT_COMMITTEES[chainId];
  if (!c) return null;
  return {
    id: c.id,
    quorum: c.quorum,
    runBy: c.runBy,
    members: c.members.map((m) => ({ address: m.address, name: m.name, reads: m.reads })),
  };
}

export function toEventView(e: EventRow): EventView {
  return {
    eventId: e.event_id as Hex,
    league: e.league,
    question: e.question,
    rules: e.rules,
    termsHash: e.terms_hash as Hex,
    home: e.home,
    away: e.away,
    startsAt: Number(e.starts_at),
    closesAt: Number(e.closes_at),
    answerFrom: Number(e.answer_from),
    answerBy: Number(e.answer_by),
    feeBps: e.fee_bps,
    state: e.state === "listing" ? "open" : e.state,
    yesPool: e.yes_pool,
    noPool: e.no_pool,
    calls: e.calls,
    answer: e.answer,
    voidReason: e.void_reason as EventView["voidReason"],
    fee: e.fee,
    prize: e.prize,
    decidedAt: e.decided_at?.toISOString() ?? null,
    listedTx: e.listed_tx as Hex | null,
  };
}

export function registerEventRoutes(app: HttpServer, ctx: ApiContext): void {
  app.get(eventBoardRoute.path, async (request, reply) => {
    const { query } = parseRoute(eventBoardRoute, request);
    const rows = await eventBoard(ctx.db, query.chainId, RECENT_SEC, BOARD_SIZE);
    return sendRoute(reply, eventBoardRoute, { events: rows.map(toEventView), committee: committeeOf(query.chainId) });
  });

  app.get(eventCallsRoute.path, async (request, reply) => {
    const { query } = parseRoute(eventCallsRoute, request);
    const rows = await eventCallsOf(ctx.db, query.chainId, query.owner, CALLS_PAGE);
    return sendRoute(reply, eventCallsRoute, {
      calls: rows.map((c) => ({
        ticketId: c.ticket_id,
        eventId: c.event_id as Hex,
        question: c.question,
        yes: c.yes,
        stake: c.stake,
        status: c.status,
        amount: c.amount,
        callTx: c.call_tx as Hex | null,
        paidTx: c.paid_tx as Hex | null,
        createdAt: c.created_at.toISOString(),
      })),
    });
  });

  app.get(eventDetailRoute.path, async (request, reply) => {
    const { params, query } = parseRoute(eventDetailRoute, request);
    const [e, answers] = await Promise.all([
      eventById(ctx.db, query.chainId, params.eventId),
      answersOf(ctx.db, query.chainId, params.eventId),
    ]);
    const committee = committeeOf(query.chainId);
    if (!e || !committee) throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", "no such question");
    return sendRoute(reply, eventDetailRoute, {
      event: toEventView(e),
      committee,
      answers: answers.map((a) => ({
        member: a.member as Address,
        yes: a.yes,
        statement: a.statement,
        statementHash: a.statement_hash as Hex,
        attestedAt: Number(a.attested_at),
        posted: a.posted,
        txHash: a.tx_hash as Hex | null,
      })),
    });
  });

  app.post(placeEventCallRoute.path, limited, async (request, reply) => {
    const { body } = parseRoute(placeEventCallRoute, request);
    const placed = await eventsOn(ctx, body.chainId).place({ ...body, signature: body.signature as Hex });
    return sendRoute(reply, placeEventCallRoute, placed);
  });
}
