import type { ChainId } from "@senryo/config";
import {
  type ClosedPosition,
  ClosedPositionsDocument,
  closedSinceWhere,
  createIndexerClient,
  DailyAggregateDocument,
  DailyAggregateProbeDocument,
  type DailyRow,
  DailyStatsDocument,
  dailyWhere,
  type FeedFill,
  FeedFillsDocument,
  type FillKey,
  fillsAfterWhere,
  type IndexerClient,
  IndexerError,
  MarketPositionsDocument,
  type OpenPosition,
  openInMarketWhere,
  type PositionOwner,
  PositionOwnerDocument,
  type RecentPositions,
  RecentPositionsDocument,
  type SizeKey,
  type UserTotals,
  UserTotalsDocument,
  usersWhere,
  type WindowFill,
  WindowFillsDocument,
} from "@senryo/indexer-client";
import type { Logger } from "@senryo/service-common";
import {
  AGGREGATE_REPROBE_MS,
  INDEXER_IN_CHUNK,
  INDEXER_PAGE,
  RECENT_POSITIONS_PER_USER,
  SOCIAL_INDEXER_TIMEOUT_MS,
} from "./constants.ts";
import { sumDays, type Totals } from "./leaderboard-math.ts";

/**
 * What the social layer reads from the indexer (S12b.4/5). The api database and the indexer are separate, so every
 * join happens here, in pages, always scoped to one chain. The interface is the seam the social check mocks.
 * Every method throws when the indexer is unavailable — callers keep their last good state, never a fabricated zero.
 */
export interface SocialIndexer {
  /** Fills strictly after `after` (block, id), at or after `since`, of `users` (null = everyone), oldest first. */
  feedFills(
    chainId: ChainId,
    after: FillKey | null,
    users: readonly string[] | null,
    since: number,
    limit: number,
  ): Promise<FeedFill[]>;
  /** Every fill of `users` at or after `since` (the rolling 24h window). */
  windowFills(chainId: ChainId, users: readonly string[], since: number): Promise<WindowFill[]>;
  /** Per-user totals of the UTC-day buckets for each `sinceDay` (inclusive). */
  dayTotals(
    chainId: ChainId,
    users: readonly string[],
    sinceDays: readonly number[],
  ): Promise<Map<number, Map<string, Totals>>>;
  /** Lifetime totals per user (the indexer's `User` row; equal to the sum of its day buckets). */
  userTotals(chainId: ChainId, users: readonly string[]): Promise<UserTotals[]>;
  /** The latest positions per user (asset clusters). */
  recentPositions(chainId: ChainId, users: readonly string[]): Promise<RecentPositions[]>;
  /** Positions of `users` closed at or after `since`. */
  closedSince(chainId: ChainId, users: readonly string[], since: number): Promise<ClosedPosition[]>;
  /** Open positions in one market (indexer id, `ours-0`) of `users`, largest first. */
  marketHolders(chainId: ChainId, marketId: string, users: readonly string[]): Promise<OpenPosition[]>;
  positionOwner(chainId: ChainId, positionId: string): Promise<PositionOwner>;
  /** Accounts among `users` that deposited on any of `chainIds` (weighted reporters). */
  fundedAmong(chainIds: readonly ChainId[], users: readonly string[]): Promise<Set<string>>;
}

/** No `INDEXER_GRAPHQL_URL`: every read fails as "unavailable" (leaderboard 503, poller idle, positions unverifiable). */
export class UnavailableSocialIndexer implements SocialIndexer {
  private fail(): never {
    throw new IndexerError("network", "indexer not configured");
  }
  feedFills = async (): Promise<FeedFill[]> => this.fail();
  windowFills = async (): Promise<WindowFill[]> => this.fail();
  dayTotals = async (): Promise<Map<number, Map<string, Totals>>> => this.fail();
  userTotals = async (): Promise<UserTotals[]> => this.fail();
  recentPositions = async (): Promise<RecentPositions[]> => this.fail();
  closedSince = async (): Promise<ClosedPosition[]> => this.fail();
  marketHolders = async (): Promise<OpenPosition[]> => this.fail();
  positionOwner = async (): Promise<PositionOwner> => this.fail();
  fundedAmong = async (): Promise<Set<string>> => this.fail();
}

function chunks<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Keyset paging: `fetch(after)` returns rows after the key; stop on a short page. */
async function pageAll<T, K>(fetch: (after: K | null) => Promise<T[]>, keyOf: (row: T) => K): Promise<T[]> {
  const out: T[] = [];
  let after: K | null = null;
  for (;;) {
    const rows = await fetch(after);
    out.push(...rows);
    const last = rows.at(-1);
    if (rows.length < INDEXER_PAGE || last === undefined) return out;
    after = keyOf(last);
  }
}

export class EnvioSocialIndexer implements SocialIndexer {
  private readonly client: IndexerClient;
  /** Per chain: whether public aggregates work, and when to probe again. */
  private readonly aggregates = new Map<ChainId, { ok: boolean; until: number }>();

  constructor(
    url: string,
    private readonly log: Logger,
  ) {
    this.client = createIndexerClient({ url, timeoutMs: SOCIAL_INDEXER_TIMEOUT_MS });
  }

  feedFills(chainId: ChainId, after: FillKey | null, users: readonly string[] | null, since: number, limit: number) {
    return this.client.request(FeedFillsDocument, { where: fillsAfterWhere(chainId, after, { users, since }), limit });
  }

  async windowFills(chainId: ChainId, users: readonly string[], since: number): Promise<WindowFill[]> {
    const out: WindowFill[] = [];
    for (const part of chunks(users, INDEXER_IN_CHUNK)) {
      const rows = await pageAll<WindowFill, FillKey>(
        (after) =>
          this.client.request(WindowFillsDocument, {
            where: fillsAfterWhere(chainId, after, { users: part, since }),
            limit: INDEXER_PAGE,
          }),
        (f) => ({ block: f.block, id: f.id }),
      );
      out.push(...rows);
    }
    return out;
  }

  async dayTotals(chainId: ChainId, users: readonly string[], sinceDays: readonly number[]) {
    const out = new Map<number, Map<string, Totals>>();
    if (users.length === 0 || sinceDays.length === 0) return out;
    if (await this.aggregatesOn(chainId)) {
      try {
        for (const sinceDay of sinceDays) out.set(sinceDay, await this.aggregateDays(chainId, users, sinceDay));
        return out;
      } catch (error) {
        if (!(error instanceof IndexerError) || error.kind !== "graphql") throw error;
        this.aggregates.set(chainId, { ok: false, until: Date.now() + AGGREGATE_REPROBE_MS });
        this.log.info({ chainId }, "indexer aggregates refused; paging day buckets");
      }
    }
    const rows = await this.dailyRows(chainId, users, Math.min(...sinceDays));
    for (const sinceDay of sinceDays) out.set(sinceDay, sumDays(rows, sinceDay));
    return out;
  }

  async userTotals(chainId: ChainId, users: readonly string[]): Promise<UserTotals[]> {
    const out: UserTotals[] = [];
    for (const part of chunks(users, INDEXER_IN_CHUNK)) {
      out.push(
        ...(await pageAll<UserTotals, string>(
          (after) =>
            this.client.request(UserTotalsDocument, { where: usersWhere(chainId, part, after), limit: INDEXER_PAGE }),
          (u) => u.id,
        )),
      );
    }
    return out;
  }

  async recentPositions(chainId: ChainId, users: readonly string[]): Promise<RecentPositions[]> {
    const out: RecentPositions[] = [];
    for (const part of chunks(users, INDEXER_IN_CHUNK)) {
      const where = usersWhere(chainId, part, null);
      out.push(...(await this.client.request(RecentPositionsDocument, { where, perUser: RECENT_POSITIONS_PER_USER })));
    }
    return out;
  }

  async closedSince(chainId: ChainId, users: readonly string[], since: number): Promise<ClosedPosition[]> {
    const out: ClosedPosition[] = [];
    for (const part of chunks(users, INDEXER_IN_CHUNK)) {
      out.push(
        ...(await pageAll<ClosedPosition, string>(
          (after) =>
            this.client.request(ClosedPositionsDocument, {
              where: closedSinceWhere(chainId, part, since, after),
              limit: INDEXER_PAGE,
            }),
          (p) => p.id,
        )),
      );
    }
    return out;
  }

  /** A short list filters at the indexer (`user_id _in`); a longer one pages the market's open positions and filters
   *  here, so no request carries more than INDEXER_IN_CHUNK addresses. */
  async marketHolders(chainId: ChainId, marketId: string, users: readonly string[]): Promise<OpenPosition[]> {
    const listed = users.length <= INDEXER_IN_CHUNK ? users : null;
    const rows = await pageAll<OpenPosition, SizeKey>(
      (after) =>
        this.client.request(MarketPositionsDocument, {
          where: openInMarketWhere(chainId, marketId, listed, after),
          limit: INDEXER_PAGE,
        }),
      (p) => ({ size: p.size, id: p.id }),
    );
    if (listed !== null) return rows;
    const keep = new Set(users.map((u) => u.toLowerCase()));
    return rows.filter((p) => keep.has(p.user_id.toLowerCase()));
  }

  positionOwner(chainId: ChainId, positionId: string): Promise<PositionOwner> {
    return this.client.request(PositionOwnerDocument, { chainId, id: positionId });
  }

  async fundedAmong(chainIds: readonly ChainId[], users: readonly string[]): Promise<Set<string>> {
    const funded = new Set<string>();
    for (const chainId of chainIds) {
      for (const u of await this.userTotals(chainId, users)) if (u.deposited > 0n) funded.add(u.id);
    }
    return funded;
  }

  private async aggregatesOn(chainId: ChainId): Promise<boolean> {
    const known = this.aggregates.get(chainId);
    if (known && known.until > Date.now()) return known.ok;
    let ok = false;
    try {
      await this.client.request(DailyAggregateProbeDocument, { chainId });
      ok = true;
    } catch (error) {
      if (!(error instanceof IndexerError) || error.kind !== "graphql") throw error;
    }
    this.aggregates.set(chainId, { ok, until: Date.now() + AGGREGATE_REPROBE_MS });
    return ok;
  }

  private async aggregateDays(chainId: ChainId, users: readonly string[], sinceDay: number) {
    const out = new Map<string, Totals>();
    for (const part of chunks(users, INDEXER_IN_CHUNK)) {
      const rows = await this.client.request(DailyAggregateDocument, {
        where: usersWhere(chainId, part, null),
        sinceDay,
      });
      for (const row of rows) {
        const sum = row.daily_aggregate.aggregate?.sum;
        if (!sum || sum.trades === 0) continue;
        out.set(row.id, { netPnl: sum.realizedPnl - sum.fees - sum.funding, notional: sum.volume, trades: sum.trades });
      }
    }
    return out;
  }

  private async dailyRows(chainId: ChainId, users: readonly string[], sinceDay: number): Promise<DailyRow[]> {
    const out: DailyRow[] = [];
    for (const part of chunks(users, INDEXER_IN_CHUNK)) {
      out.push(
        ...(await pageAll<DailyRow, string>(
          (after) =>
            this.client.request(DailyStatsDocument, {
              where: dailyWhere(chainId, part, sinceDay, after),
              limit: INDEXER_PAGE,
            }),
          (d) => d.id,
        )),
      );
    }
    return out;
  }
}
