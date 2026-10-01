import { LEADERBOARD_PERIODS, type LeaderboardPeriod, type SocialIdentity, TOP_TRADES_MAX } from "@senryo/api-client";
import type { ChainId } from "@senryo/config";
import type { ClosedPosition, RecentPositions } from "@senryo/indexer-client";
import { type Db, type Logger, MS_PER_SECOND } from "@senryo/service-common";
import {
  ASSET_CLUSTER_MAX,
  LEADERBOARD_FLOOR,
  LEADERBOARD_REFRESH_MS,
  TOP_TRADE_MIN_NOTIONAL_USD6,
} from "./constants.ts";
import type { SocialIndexer } from "./indexer-source.ts";
import {
  type Floor,
  pickTopTrades,
  rankTotals,
  type StandingRow,
  sumFills,
  sumLifetime,
  type TopTradePick,
  type Totals,
  type Window,
  weekStartSec,
  windowOf,
} from "./leaderboard-math.ts";
import { identityOf, publicTradesColumn, sharingSinceColumn, visibleOn } from "./shared.ts";

/**
 * Leaderboard snapshots (S12b.5): every 60 s per network, over profiles listed there (and not moderation-hidden).
 * 24h from rolling fills, 7d/30d from UTC-day buckets, All from lifetime totals; ranks above the anti-farming floor;
 * weekly Top Trades from accounts that also share their trades. A failed refresh keeps the last good snapshot.
 * `forget(address)` drops an account at once (unlisted, hidden or deleted) instead of waiting for the next refresh.
 */

export interface BoardRow {
  address: string;
  rank: number;
  totals: Totals;
  /** Market symbols from the trader's positions touched in the window (latest first). */
  markets: string[];
}

export interface PeriodBoard {
  window: Window;
  floor: Floor;
  ranked: BoardRow[];
  standings: Map<string, StandingRow>;
}

export interface ChainSnapshot {
  chainId: ChainId;
  computedAt: Date;
  /** Every profile visible on this network when the snapshot ran. */
  identities: Map<string, SocialIdentity>;
  boards: Record<LeaderboardPeriod, PeriodBoard>;
  weekStartSec: number;
  topTrades: TopTradePick<ClosedPosition>[];
}

interface ListedRow {
  address: string;
  handle: string | null;
  display_name: string | null;
  avatar: string | null;
  shares: boolean;
  since: Date | null;
}

export interface LeaderboardDeps {
  db: Db;
  indexer: SocialIndexer;
  log: Logger;
  chainIds: readonly ChainId[];
  /** Clock override (unix seconds) for the social check. */
  nowSec?: () => number;
}

/** Sharing start rounded UP to whole seconds (block time): a position closed in the same second doesn't count. */
const toSec = (date: Date): number => Math.ceil(date.getTime() / MS_PER_SECOND);

/** Symbols of positions updated in the window, latest first, distinct, at most ASSET_CLUSTER_MAX. */
function clusterOf(recent: RecentPositions | undefined, window: Window): string[] {
  const symbols: string[] = [];
  for (const p of recent?.positions ?? []) {
    if (window.fromSec !== null && p.updatedAt < window.fromSec) continue;
    if (!symbols.includes(p.market.symbol)) symbols.push(p.market.symbol);
    if (symbols.length === ASSET_CLUSTER_MAX) break;
  }
  return symbols;
}

export class LeaderboardService {
  private readonly snapshots = new Map<ChainId, ChainSnapshot>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private busy = false;

  constructor(private readonly deps: LeaderboardDeps) {}

  start(): void {
    void this.refreshAll();
    this.timer = setInterval(() => void this.refreshAll(), LEADERBOARD_REFRESH_MS);
  }

  stop(): void {
    clearInterval(this.timer);
  }

  snapshot(chainId: ChainId): ChainSnapshot | undefined {
    return this.snapshots.get(chainId);
  }

  /** A tick still computing when the next fires is skipped, never stacked. */
  async refreshAll(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      for (const chainId of this.deps.chainIds) {
        try {
          await this.refresh(chainId);
        } catch (error) {
          this.deps.log.warn({ chainId, err: String(error) }, "leaderboard refresh failed; keeping last snapshot");
        }
      }
    } finally {
      this.busy = false;
    }
  }

  async refresh(chainId: ChainId): Promise<ChainSnapshot> {
    const snapshot = await this.compute(chainId);
    this.snapshots.set(chainId, snapshot);
    return snapshot;
  }

  /** Remove an account from every cached board and re-rank the rest (privacy changes apply at once). */
  forget(address: string): void {
    const key = address.toLowerCase();
    for (const snap of this.snapshots.values()) {
      snap.identities.delete(key);
      for (const board of Object.values(snap.boards)) {
        board.standings.delete(key);
        board.ranked = board.ranked.filter((r) => r.address !== key).map((r, i) => ({ ...r, rank: i + 1 }));
        for (const r of board.ranked)
          board.standings.set(r.address, { status: "ranked", rank: r.rank, totals: r.totals });
      }
      snap.topTrades = snap.topTrades.filter((t) => t.position.user_id !== key);
    }
  }

  private async compute(chainId: ChainId): Promise<ChainSnapshot> {
    const { db, indexer } = this.deps;
    const nowSec = this.deps.nowSec?.() ?? Math.floor(Date.now() / MS_PER_SECOND);
    const listed = await db<ListedRow[]>`
      SELECT p.address, p.handle, p.display_name, p.avatar, p.${db(publicTradesColumn(chainId))} AS shares,
             p.${db(sharingSinceColumn(chainId))} AS since
        FROM profiles p WHERE ${visibleOn(db, "p", chainId)}`;
    const users = listed.map((r) => r.address);
    const windows = Object.fromEntries(LEADERBOARD_PERIODS.map((p) => [p, windowOf(p, nowSec)])) as Record<
      LeaderboardPeriod,
      Window
    >;
    const sharingSince = new Map(
      listed.flatMap((r) => (r.shares && r.since ? [[r.address, toSec(r.since)] as const] : [])),
    );
    const weekStart = weekStartSec(nowSec);
    const dayStarts = [windows["7d"].sinceDay ?? nowSec, windows["30d"].sinceDay ?? nowSec];
    const [fills, days, lifetime, closed] =
      users.length === 0
        ? [[], new Map<number, Map<string, Totals>>(), [], []]
        : await Promise.all([
            indexer.windowFills(chainId, users, windows["24h"].fromSec ?? nowSec),
            indexer.dayTotals(chainId, users, dayStarts),
            indexer.userTotals(chainId, users),
            sharingSince.size > 0 ? indexer.closedSince(chainId, [...sharingSince.keys()], weekStart) : [],
          ]);
    const totals: Record<LeaderboardPeriod, Map<string, Totals>> = {
      "24h": sumFills(fills, windows["24h"].fromSec ?? nowSec, Number.POSITIVE_INFINITY),
      "7d": days.get(dayStarts[0] ?? nowSec) ?? new Map(),
      "30d": days.get(dayStarts[1] ?? nowSec) ?? new Map(),
      all: sumLifetime(lifetime),
    };
    const ranked = Object.fromEntries(
      LEADERBOARD_PERIODS.map((p) => [p, rankTotals(totals[p], LEADERBOARD_FLOOR[p])]),
    ) as Record<LeaderboardPeriod, ReturnType<typeof rankTotals>>;
    const rankedUsers = new Set(LEADERBOARD_PERIODS.flatMap((p) => ranked[p].ranked.map((r) => r.address)));
    const recent =
      rankedUsers.size === 0 ? [] : await indexer.recentPositions(chainId, [...rankedUsers]).catch(() => []);
    const recentOf = new Map(recent.map((r) => [r.id, r]));
    const boards = Object.fromEntries(
      LEADERBOARD_PERIODS.map((p) => [
        p,
        {
          window: windows[p],
          floor: LEADERBOARD_FLOOR[p],
          ranked: ranked[p].ranked.map((r) => ({ ...r, markets: clusterOf(recentOf.get(r.address), windows[p]) })),
          standings: ranked[p].standings,
        },
      ]),
    ) as Record<LeaderboardPeriod, PeriodBoard>;
    return {
      chainId,
      computedAt: new Date(nowSec * MS_PER_SECOND),
      identities: new Map(listed.map((r) => [r.address, identityOf(r)])),
      boards,
      weekStartSec: weekStart,
      topTrades: pickTopTrades(closed, sharingSince, weekStart, TOP_TRADE_MIN_NOTIONAL_USD6, TOP_TRADES_MAX),
    };
  }
}
