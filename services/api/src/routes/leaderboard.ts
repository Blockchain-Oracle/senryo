import {
  LEADERBOARD_METRIC,
  type Leaderboard,
  type LeaderboardEntry,
  leaderboardRoute,
  RECOMMENDATIONS_MAX,
  recommendationsRoute,
  type SocialIdentity,
  type Standing,
  topTradesRoute,
} from "@senryo/api-client";
import { type Address, getAddress } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import {
  type Db,
  HTTP_STATUS,
  HttpError,
  type HttpServer,
  MS_PER_SECOND,
  parseRoute,
  sendRoute,
} from "@senryo/service-common";
import { LEADERBOARD_DEFAULT_LIMIT, LEADERBOARD_REFRESH_MS, SOCIAL_READ_RATE } from "../social/constants.ts";
import type { ChainSnapshot, PeriodBoard } from "../social/leaderboard.ts";
import { NO_ACTIVITY } from "../social/leaderboard-math.ts";
import type { SocialRuntime } from "../social/runtime.ts";
import { optionalSession, requireSession } from "../social/shared.ts";

/**
 * Leaderboard, weekly Top Trades and follow recommendations (S12b.5, S12b.3). Served from the 60 s snapshots; until a
 * network's first snapshot exists the answer is 503 UPSTREAM_UNAVAILABLE (never an empty board that reads as "nobody").
 */

const isoOf = (sec: number): string => new Date(sec * MS_PER_SECOND).toISOString();

function snapshotOf(ctx: SocialRuntime, chainId: ChainId): ChainSnapshot {
  const snap = ctx.social.leaderboard.snapshot(chainId);
  if (!snap) {
    throw new HttpError(
      HTTP_STATUS.unavailable,
      "UPSTREAM_UNAVAILABLE",
      "leaderboard not computed yet",
      LEADERBOARD_REFRESH_MS / MS_PER_SECOND,
    );
  }
  return snap;
}

/** Accounts `me` follows, and accounts with a block either way (one round trip). */
async function relationsOf(db: Db, me: string): Promise<{ following: Set<string>; blocked: Set<string> }> {
  const rows = await db<{ address: string; kind: "following" | "blocked" }[]>`
    SELECT followee AS address, 'following' AS kind FROM follows WHERE follower = ${me}
    UNION ALL SELECT blocked, 'blocked' FROM blocks WHERE blocker = ${me}
    UNION ALL SELECT blocker, 'blocked' FROM blocks WHERE blocked = ${me}`;
  return {
    following: new Set(rows.filter((r) => r.kind === "following").map((r) => r.address)),
    blocked: new Set(rows.filter((r) => r.kind === "blocked").map((r) => r.address)),
  };
}

function identity(snap: ChainSnapshot, address: string): SocialIdentity {
  return (
    snap.identities.get(address) ?? {
      address: getAddress(address) as Address,
      handle: null,
      displayName: null,
      avatar: null,
    }
  );
}

function standingOf(snap: ChainSnapshot, board: PeriodBoard, me: string, scopedRank: number | null): Standing {
  if (!snap.identities.has(me)) {
    return { status: "not_listed", rank: null, globalRank: null, netPnlUsd6: null, notionalUsd6: null, trades: null };
  }
  const s = board.standings.get(me) ?? NO_ACTIVITY;
  return {
    status: s.status,
    rank: s.status === "ranked" ? scopedRank : null,
    globalRank: s.rank,
    netPnlUsd6: s.totals?.netPnl ?? null,
    notionalUsd6: s.totals?.notional ?? null,
    trades: s.totals?.trades ?? null,
  };
}

export function registerLeaderboardRoutes(app: HttpServer, ctx: SocialRuntime): void {
  app.get(leaderboardRoute.path, { config: { rateLimit: SOCIAL_READ_RATE } }, async (request, reply) => {
    const { query } = parseRoute(leaderboardRoute, request);
    const session = await optionalSession(ctx, request);
    if (query.scope === "following" && !session) {
      throw new HttpError(HTTP_STATUS.unauthorized, "UNAUTHORIZED", "sign in to rank among the people you follow");
    }
    const snap = snapshotOf(ctx, query.chainId);
    const board = snap.boards[query.period];
    const me = session?.address.toLowerCase() ?? null;
    const rel = me ? await relationsOf(ctx.db, me) : { following: new Set<string>(), blocked: new Set<string>() };
    const scoped =
      query.scope === "following" && me
        ? board.ranked.filter((r) => r.address === me || rel.following.has(r.address))
        : board.ranked;
    const ranked = scoped.map((r, i) => ({ row: r, rank: query.scope === "following" ? i + 1 : r.rank }));
    const entries: LeaderboardEntry[] = ranked
      .filter(({ row }) => !rel.blocked.has(row.address))
      .slice(0, query.limit ?? LEADERBOARD_DEFAULT_LIMIT)
      .map(({ row, rank }) => ({
        ...identity(snap, row.address),
        rank,
        globalRank: row.rank,
        netPnlUsd6: row.totals.netPnl,
        notionalUsd6: row.totals.notional,
        trades: row.totals.trades,
        markets: row.markets,
      }));
    const mine = me ? (ranked.find(({ row }) => row.address === me)?.rank ?? null) : null;
    const body: Leaderboard = {
      chainId: query.chainId,
      period: query.period,
      scope: query.scope,
      metric: LEADERBOARD_METRIC,
      window: {
        kind: board.window.kind,
        from: board.window.fromSec === null ? null : isoOf(board.window.fromSec),
        to: isoOf(board.window.toSec),
      },
      floor: board.floor,
      computedAt: snap.computedAt.toISOString(),
      entries,
      you: me ? standingOf(snap, board, me, mine) : null,
    };
    return sendRoute(reply, leaderboardRoute, body);
  });

  app.get(topTradesRoute.path, { config: { rateLimit: SOCIAL_READ_RATE } }, async (request, reply) => {
    const { query } = parseRoute(topTradesRoute, request);
    const snap = snapshotOf(ctx, query.chainId);
    return sendRoute(reply, topTradesRoute, {
      chainId: query.chainId,
      weekStart: isoOf(snap.weekStartSec),
      computedAt: snap.computedAt.toISOString(),
      items: snap.topTrades.map((t, i) => ({
        rank: i + 1,
        trader: identity(snap, t.position.user_id),
        positionId: t.position.id,
        marketId: t.position.market.id,
        symbol: t.position.market.symbol,
        venue: t.position.venue,
        side: t.position.side,
        netPnlUsd6: t.netPnl,
        notionalUsd6: t.notional,
        openedAt: isoOf(t.position.openedAt),
        closedAt: isoOf(t.position.closedAt ?? t.position.openedAt),
        closeTxHash: (t.closeTxHash ?? null) as `0x${string}` | null,
      })),
    });
  });

  /** S12b.3: the 30d ranked floor, minus yourself, accounts you follow and blocks either way; none preselected. */
  app.get(recommendationsRoute.path, { config: { rateLimit: SOCIAL_READ_RATE } }, async (request, reply) => {
    const s = await requireSession(ctx, request);
    const { query } = parseRoute(recommendationsRoute, request);
    const snap = snapshotOf(ctx, query.chainId);
    const me = s.address.toLowerCase();
    const rel = await relationsOf(ctx.db, me);
    const items = snap.boards["30d"].ranked
      .filter((r) => r.address !== me && !rel.following.has(r.address) && !rel.blocked.has(r.address))
      .slice(0, RECOMMENDATIONS_MAX)
      .map((r) => ({
        ...identity(snap, r.address),
        rank: r.rank,
        netPnlUsd6: r.totals.netPnl,
        trades: r.totals.trades,
        reason: "top_30d" as const,
      }));
    return sendRoute(reply, recommendationsRoute, { chainId: query.chainId, items });
  });
}
