import {
  callerStatsRoute,
  callsRoute,
  callTimelineRoute,
  leaderboardRoute,
  windowProofRoute,
} from "@senryo/api-client";
import type { Hex } from "@senryo/chain";
import type { HttpServer } from "@senryo/service-common";
import { HTTP_STATUS, HttpError, parseRoute, sendRoute } from "@senryo/service-common";
import type { ApiContext } from "../context.ts";
import { HISTORY_MAX_AGE, LEADERBOARD_MAX_AGE } from "../history/constants.ts";
import { IndexerReader } from "../history/reader.ts";

/**
 * History over HTTP (S4): a caller's calls and their timelines, a window's proof and crowd split, the leaderboard and
 * a caller's record — all read from the indexer's tables. Public reads, like the chain they mirror.
 */
export function registerHistoryRoutes(app: HttpServer, ctx: ApiContext): void {
  const reader = new IndexerReader(ctx.db, ctx.env.INDEXER_SCHEMA);
  const notFound = (what: string) => new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", `no such ${what}`);

  app.get(callsRoute.path, async (request, reply) => {
    const { query } = parseRoute(callsRoute, request);
    reply.header("cache-control", HISTORY_MAX_AGE);
    return sendRoute(reply, callsRoute, await reader.calls(query.chainId, query.owner, query.before));
  });

  app.get(callTimelineRoute.path, async (request, reply) => {
    const { params, query } = parseRoute(callTimelineRoute, request);
    const found = await reader.call(query.chainId, params.ticketId);
    if (!found) throw notFound("call");
    reply.header("cache-control", HISTORY_MAX_AGE);
    return sendRoute(reply, callTimelineRoute, {
      call: found.call,
      events: found.events.map((e) => ({
        kind: e.kind,
        amount: e.amount,
        priceE8: e.priceE8,
        at: e.timestamp,
        txHash: e.txHash as Hex,
      })),
    });
  });

  app.get(windowProofRoute.path, async (request, reply) => {
    const { params, query } = parseRoute(windowProofRoute, request);
    const w = await reader.window(query.chainId, params.windowId);
    if (!w) throw notFound("window");
    const print = (p: typeof w.open) =>
      p && { priceE8: p.priceE8, publishTime: p.publishTime, txHash: p.txHash as Hex };
    reply.header("cache-control", HISTORY_MAX_AGE);
    return sendRoute(reply, windowProofRoute, {
      windowId: params.windowId,
      symbol: w.series.market.symbol,
      cadenceSec: w.series.cadenceSec,
      start: w.start,
      expiry: w.expiry,
      state: w.state as "open",
      settled: w.settled,
      open: print(w.open),
      close: print(w.close),
      calls: w.calls,
      volume: w.volume,
      bandStake: w.bandStake.map(BigInt),
      openedTx: w.openedTx as Hex,
      settledTx: w.settledTx as Hex | null,
    });
  });

  app.get(leaderboardRoute.path, async (request, reply) => {
    const { query } = parseRoute(leaderboardRoute, request);
    const rows = await reader.leaderboard(query.chainId, query.period);
    reply.header("cache-control", LEADERBOARD_MAX_AGE);
    return sendRoute(reply, leaderboardRoute, {
      period: query.period,
      rows: rows.map((r, i) => ({
        rank: i + 1,
        owner: r.owner as Hex,
        handle: r.handle,
        pnl: String(r.pnl),
        calls: r.calls,
        wins: r.wins,
      })),
    });
  });

  app.get(callerStatsRoute.path, async (request, reply) => {
    const { query } = parseRoute(callerStatsRoute, request);
    const a = await reader.stats(query.chainId, query.owner);
    reply.header("cache-control", HISTORY_MAX_AGE);
    return sendRoute(reply, callerStatsRoute, {
      calls: a?.calls ?? 0,
      staked: a?.staked ?? 0n,
      returned: a?.returned ?? 0n,
      pnl: String(a?.pnl ?? 0n),
      wins: a?.wins ?? 0,
      losses: a?.losses ?? 0,
      refunds: a?.refunds ?? 0,
      streak: a?.streak ?? 0,
      bestStreak: a?.bestStreak ?? 0,
    });
  });
}
