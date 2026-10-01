import type { ChainId } from "@senryo/config";
import {
  type ClosedPosition,
  type DailyRow,
  type FeedFill,
  type FillKey,
  IndexerError,
  type OpenPosition,
  type PositionOwner,
  type RecentPositions,
  type UserTotals,
  type WindowFill,
} from "@senryo/indexer-client";
import type { SocialIndexer } from "../src/social/indexer-source.ts";
import { sumDays, type Totals } from "../src/social/leaderboard-math.ts";

/**
 * An in-memory indexer for the social check: seeded rows per chain, answered with the same filters the GraphQL
 * documents send (chain, users, keysets), and `dayTotals` through the same pure `sumDays` the paging path uses.
 * Every query records its chain so the check can assert the `chainId` scoping (D-173).
 */

type OnChain<T> = T & { chainId: ChainId };
export type MockPosition = OnChain<ClosedPosition> & Pick<OpenPosition, "size" | "entryPrice"> & { updatedAt: number };

const lower = (users: readonly string[] | null) => (users === null ? null : new Set(users.map((u) => u.toLowerCase())));
const inUsers = (set: Set<string> | null, user: string) => set === null || set.has(user.toLowerCase());
const afterKey = (f: { block: number; id: string }, key: FillKey | null) =>
  key === null || f.block > key.block || (f.block === key.block && f.id > key.id);
const byKey = (a: { block: number; id: string }, b: { block: number; id: string }) =>
  a.block - b.block || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export class MockIndexer implements SocialIndexer {
  readonly fills: OnChain<FeedFill>[] = [];
  readonly days: OnChain<DailyRow>[] = [];
  readonly totals: OnChain<UserTotals>[] = [];
  readonly positions: MockPosition[] = [];
  /** Chains each call asked for. */
  readonly chainsAsked: ChainId[] = [];
  /** While true, `marketHolders` fails as an unreachable indexer would. */
  holdersDown = false;

  async feedFills(
    chainId: ChainId,
    after: FillKey | null,
    users: readonly string[] | null,
    since: number,
    limit: number,
  ) {
    this.chainsAsked.push(chainId);
    const set = lower(users);
    return this.fills
      .filter((f) => f.chainId === chainId && inUsers(set, f.user_id) && f.timestamp >= since && afterKey(f, after))
      .sort(byKey)
      .slice(0, limit);
  }

  async windowFills(chainId: ChainId, users: readonly string[], since: number): Promise<WindowFill[]> {
    this.chainsAsked.push(chainId);
    const set = lower(users);
    return this.fills.filter((f) => f.chainId === chainId && inUsers(set, f.user_id) && f.timestamp >= since);
  }

  async dayTotals(chainId: ChainId, users: readonly string[], sinceDays: readonly number[]) {
    this.chainsAsked.push(chainId);
    const set = lower(users);
    const rows = this.days.filter((d) => d.chainId === chainId && inUsers(set, d.user_id));
    return new Map<number, Map<string, Totals>>(sinceDays.map((day) => [day, sumDays(rows, day)]));
  }

  async userTotals(chainId: ChainId, users: readonly string[]): Promise<UserTotals[]> {
    this.chainsAsked.push(chainId);
    const set = lower(users);
    return this.totals.filter((u) => u.chainId === chainId && inUsers(set, u.id));
  }

  async recentPositions(chainId: ChainId, users: readonly string[]): Promise<RecentPositions[]> {
    this.chainsAsked.push(chainId);
    return users.map((id) => ({
      id,
      positions: this.positions
        .filter((p) => p.chainId === chainId && p.user_id === id)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((p) => ({ updatedAt: p.updatedAt, market: { symbol: p.market.symbol } })),
    }));
  }

  async closedSince(chainId: ChainId, users: readonly string[], since: number): Promise<ClosedPosition[]> {
    this.chainsAsked.push(chainId);
    const set = lower(users);
    return this.positions.filter(
      (p) =>
        p.chainId === chainId &&
        inUsers(set, p.user_id) &&
        p.status === "CLOSED" &&
        p.closedAt !== undefined &&
        p.closedAt >= since,
    );
  }

  async marketHolders(chainId: ChainId, marketId: string, users: readonly string[]): Promise<OpenPosition[]> {
    this.chainsAsked.push(chainId);
    if (this.holdersDown) throw new IndexerError("network", "MarketPositions: indexer down");
    const set = lower(users);
    return this.positions
      .filter(
        (p) => p.chainId === chainId && p.market.id === marketId && p.status === "OPEN" && inUsers(set, p.user_id),
      )
      .sort((a, b) => (a.size === b.size ? (a.id < b.id ? -1 : 1) : a.size > b.size ? -1 : 1))
      .map((p) => ({
        id: p.id,
        user_id: p.user_id,
        side: p.side,
        size: p.size,
        entryPrice: p.entryPrice,
        openedAt: p.openedAt,
      }));
  }

  async positionOwner(chainId: ChainId, positionId: string): Promise<PositionOwner> {
    this.chainsAsked.push(chainId);
    const p = this.positions.find((x) => x.chainId === chainId && x.id === positionId);
    return p ? { id: p.id, user_id: p.user_id, market: { id: p.market.id } } : null;
  }

  async fundedAmong(chainIds: readonly ChainId[], users: readonly string[]): Promise<Set<string>> {
    const set = lower(users);
    return new Set(
      this.totals
        .filter((u) => chainIds.includes(u.chainId) && inUsers(set, u.id) && u.deposited > 0n)
        .map((u) => u.id),
    );
  }
}
