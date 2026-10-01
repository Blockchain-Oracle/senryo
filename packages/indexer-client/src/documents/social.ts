/**
 * Social reads (S12b.4/5, services/api only): the feed poller's fill keyset, leaderboard windows (rolling fills,
 * UTC-day buckets, lifetime totals), asset clusters, weekly closed positions, a market's open positions (Holders) and
 * a position's owner. Every `where` carries `chainId` (D-173): rows are per chain and ids repeat across chains.
 * Keysets page in a stable total order (`block, id` for fills; `size desc, id` for a market's open positions; `id`
 * elsewhere) so a page boundary never skips or repeats a row.
 */
import { z } from "zod";
import { type ChainWhere, defineDocument, type ResultOf } from "../client.ts";
import { bigintish, fillKind, optionalBigint, optionalInt, positionStatus, side, venue } from "../scalars.ts";
import { MARKET_REF_FIELDS, marketRef } from "./fragments.ts";

/** A complete `where` (always chain-scoped, enforced by the type) and a partial clause merged into one. */
type Where = ChainWhere;
type Clause = Record<string, unknown>;

interface PageVars {
  where: Where;
  limit: number;
}

/** A fill keyset position: `block` then the event id (`<block>_<logIndex>`). */
export interface FillKey {
  block: number;
  id: string;
}

const chainScope = (chainId: number): ChainWhere => ({ chainId: { _eq: chainId } });
const usersScope = (field: string, users: readonly string[] | null): Clause =>
  users === null ? {} : { [field]: { _in: users.map((u) => u.toLowerCase()) } };

// ---------------------------------------------------------------- feed fills (poller)

const feedFill = z.object({
  id: z.string(),
  user_id: z.string(),
  venue,
  kind: fillKind,
  side,
  size: bigintish,
  price: optionalBigint,
  notional: bigintish,
  fee: bigintish,
  realizedPnl: bigintish,
  funding: bigintish,
  borrow: bigintish,
  timestamp: z.number().int(),
  block: z.number().int(),
  txHash: z.string(),
  market: marketRef,
  position: z.object({
    id: z.string(),
    status: positionStatus,
    realizedPnl: bigintish,
    feesPaid: bigintish,
    fundingPaid: bigintish,
    borrowPaid: bigintish,
  }),
});
export type FeedFill = z.infer<typeof feedFill>;

export const FeedFillsDocument = defineDocument<PageVars>()(
  "FeedFills",
  `query FeedFills($where: Fill_bool_exp!, $limit: Int!) {
    Fill(where: $where, order_by: [{ block: asc }, { id: asc }], limit: $limit) {
      id user_id venue kind side size price notional fee realizedPnl funding borrow timestamp block txHash
      market { ${MARKET_REF_FIELDS} }
      position { id status realizedPnl feesPaid fundingPaid borrowPaid }
    }
  }`,
  z.object({ Fill: z.array(feedFill) }).transform((d) => d.Fill),
);

/** Fills strictly after `after` in (block, id) order, at or after `since` (unix s), of `users` (null = everyone). */
export function fillsAfterWhere(
  chainId: number,
  after: FillKey | null,
  opts: { users: readonly string[] | null; since: number },
): Where {
  return {
    ...chainScope(chainId),
    ...usersScope("user_id", opts.users),
    timestamp: { _gte: opts.since },
    ...(after
      ? { _or: [{ block: { _gt: after.block } }, { block: { _eq: after.block }, id: { _gt: after.id } }] }
      : {}),
  };
}

// ---------------------------------------------------------------- rolling window fills (24h leaderboard)

const windowFill = z.object({
  id: z.string(),
  user_id: z.string(),
  notional: bigintish,
  fee: bigintish,
  realizedPnl: bigintish,
  funding: bigintish,
  borrow: bigintish,
  timestamp: z.number().int(),
  block: z.number().int(),
  market: z.object({ symbol: z.string() }),
});
export type WindowFill = z.infer<typeof windowFill>;

export const WindowFillsDocument = defineDocument<PageVars>()(
  "WindowFills",
  `query WindowFills($where: Fill_bool_exp!, $limit: Int!) {
    Fill(where: $where, order_by: [{ block: asc }, { id: asc }], limit: $limit) {
      id user_id notional fee realizedPnl funding borrow timestamp block market { symbol }
    }
  }`,
  z.object({ Fill: z.array(windowFill) }).transform((d) => d.Fill),
);

// ---------------------------------------------------------------- UTC-day buckets (7d / 30d leaderboard)

const dailyRow = z.object({
  id: z.string(),
  user_id: z.string(),
  day: z.number().int(),
  realizedPnl: bigintish,
  fees: bigintish,
  /** The indexer folds borrow into the day's funding (indexer/src/lib/markets.ts recordTradeStats). */
  funding: bigintish,
  volume: bigintish,
  trades: z.number().int(),
});
export type DailyRow = z.infer<typeof dailyRow>;

export const DailyStatsDocument = defineDocument<PageVars>()(
  "DailyStats",
  `query DailyStats($where: UserDailyStats_bool_exp!, $limit: Int!) {
    UserDailyStats(where: $where, order_by: { id: asc }, limit: $limit) {
      id user_id day realizedPnl fees funding volume trades
    }
  }`,
  z.object({ UserDailyStats: z.array(dailyRow) }).transform((d) => d.UserDailyStats),
);

export function dailyWhere(chainId: number, users: readonly string[], sinceDay: number, afterId: string | null): Where {
  return {
    ...chainScope(chainId),
    ...usersScope("user_id", users),
    day: { _gte: sinceDay },
    ...(afterId === null ? {} : { id: { _gt: afterId } }),
  };
}

/** Probe: does the public role allow aggregates on UserDailyStats (`ENVIO_HASURA_PUBLIC_AGGREGATE`)? */
export const DailyAggregateProbeDocument = defineDocument<{ chainId: number }>()(
  "DailyAggregateProbe",
  `query DailyAggregateProbe($chainId: Int!) {
    UserDailyStats_aggregate(where: { chainId: { _eq: $chainId } }) { aggregate { count } }
  }`,
  z.object({ UserDailyStats_aggregate: z.object({ aggregate: z.object({ count: z.number().int() }).nullable() }) }),
);

const sumOrZero = bigintish.nullable().transform((v) => v ?? 0n);
const dailyAggregate = z.object({
  id: z.string(),
  daily_aggregate: z.object({
    aggregate: z
      .object({
        count: z.number().int(),
        sum: z
          .object({
            realizedPnl: sumOrZero,
            fees: sumOrZero,
            funding: sumOrZero,
            volume: sumOrZero,
            trades: z
              .number()
              .int()
              .nullable()
              .transform((v) => v ?? 0),
          })
          .nullable(),
      })
      .nullable(),
  }),
});
export type DailyAggregate = z.infer<typeof dailyAggregate>;

/** Per-user sums of the day buckets from `sinceDay` (one row per user; aggregate-enabled indexers only). */
export const DailyAggregateDocument = defineDocument<{ where: Where; sinceDay: number }>()(
  "DailyAggregate",
  `query DailyAggregate($where: User_bool_exp!, $sinceDay: Int!) {
    User(where: $where) {
      id
      daily_aggregate(where: { day: { _gte: $sinceDay } }) {
        aggregate { count sum { realizedPnl fees funding volume trades } }
      }
    }
  }`,
  z.object({ User: z.array(dailyAggregate) }).transform((d) => d.User),
);

// ---------------------------------------------------------------- lifetime totals (All) and funded reporters

const userTotals = z.object({
  id: z.string(),
  realizedPnl: bigintish,
  feesPaid: bigintish,
  fundingPaid: bigintish,
  borrowPaid: bigintish,
  volume: bigintish,
  tradeCount: z.number().int(),
  deposited: bigintish,
});
export type UserTotals = z.infer<typeof userTotals>;

export const UserTotalsDocument = defineDocument<PageVars>()(
  "UserTotals",
  `query UserTotals($where: User_bool_exp!, $limit: Int!) {
    User(where: $where, order_by: { id: asc }, limit: $limit) {
      id realizedPnl feesPaid fundingPaid borrowPaid volume tradeCount deposited
    }
  }`,
  z.object({ User: z.array(userTotals) }).transform((d) => d.User),
);

export function usersWhere(chainId: number, users: readonly string[], afterId: string | null): Where {
  return {
    ...chainScope(chainId),
    ...usersScope("id", users),
    ...(afterId === null ? {} : { id: { _gt: afterId } }),
  };
}

// ---------------------------------------------------------------- asset clusters (latest positions per user)

const recentPositions = z.object({
  id: z.string(),
  positions: z.array(z.object({ updatedAt: z.number().int(), market: z.object({ symbol: z.string() }) })),
});
export type RecentPositions = z.infer<typeof recentPositions>;

export const RecentPositionsDocument = defineDocument<{ where: Where; perUser: number }>()(
  "RecentPositions",
  `query RecentPositions($where: User_bool_exp!, $perUser: Int!) {
    User(where: $where) {
      id
      positions(order_by: [{ updatedAt: desc }, { id: desc }], limit: $perUser) { updatedAt market { symbol } }
    }
  }`,
  z.object({ User: z.array(recentPositions) }).transform((d) => d.User),
);

// ---------------------------------------------------------------- closed positions (weekly Top Trades)

const closedPosition = z.object({
  id: z.string(),
  user_id: z.string(),
  venue,
  side,
  status: positionStatus,
  realizedPnl: bigintish,
  feesPaid: bigintish,
  fundingPaid: bigintish,
  borrowPaid: bigintish,
  openedAt: z.number().int(),
  closedAt: optionalInt,
  market: marketRef,
  fills: z.array(z.object({ kind: fillKind, notional: bigintish, txHash: z.string(), block: z.number().int() })),
});
export type ClosedPosition = z.infer<typeof closedPosition>;

export const ClosedPositionsDocument = defineDocument<PageVars>()(
  "ClosedPositions",
  `query ClosedPositions($where: Position_bool_exp!, $limit: Int!) {
    Position(where: $where, order_by: { id: asc }, limit: $limit) {
      id user_id venue side status realizedPnl feesPaid fundingPaid borrowPaid openedAt closedAt
      market { ${MARKET_REF_FIELDS} }
      fills(order_by: [{ block: asc }, { id: asc }]) { kind notional txHash block }
    }
  }`,
  z.object({ Position: z.array(closedPosition) }).transform((d) => d.Position),
);

export function closedSinceWhere(
  chainId: number,
  users: readonly string[],
  since: number,
  afterId: string | null,
): Where {
  return {
    ...chainScope(chainId),
    ...usersScope("user_id", users),
    status: { _eq: "CLOSED" },
    closedAt: { _gte: since },
    ...(afterId === null ? {} : { id: { _gt: afterId } }),
  };
}

// ---------------------------------------------------------------- open positions in one market (market Holders)

/** The indexer's id of our engine's market `n` (indexer/src/lib/markets.ts `ourMarketId`). */
export const ourMarketId = (engineMarketId: number): string => `ours-${engineMarketId}`;

/** `size` is unsigned (1e18 units; `side` says which way), `entryPrice` the average entry (1e18). */
const openPosition = z.object({
  id: z.string(),
  user_id: z.string(),
  side,
  size: bigintish,
  entryPrice: bigintish,
  openedAt: z.number().int(),
});
export type OpenPosition = z.infer<typeof openPosition>;

/** A largest-first keyset position: `size` descending, then the position id. */
export interface SizeKey {
  size: bigint;
  id: string;
}

export const MarketPositionsDocument = defineDocument<PageVars>()(
  "MarketPositions",
  `query MarketPositions($where: Position_bool_exp!, $limit: Int!) {
    Position(where: $where, order_by: [{ size: desc }, { id: asc }], limit: $limit) {
      id user_id side size entryPrice openedAt
    }
  }`,
  z.object({ Position: z.array(openPosition) }).transform((d) => d.Position),
);

/** Open positions in `marketId` (indexer id) of `users` (null = everyone), after `after` in (size desc, id) order. */
export function openInMarketWhere(
  chainId: number,
  marketId: string,
  users: readonly string[] | null,
  after: SizeKey | null,
): Where {
  const size = after?.size.toString();
  return {
    ...chainScope(chainId),
    ...usersScope("user_id", users),
    market_id: { _eq: marketId },
    status: { _eq: "OPEN" },
    ...(after ? { _or: [{ size: { _lt: size } }, { size: { _eq: size }, id: { _gt: after.id } }] } : {}),
  };
}

// ---------------------------------------------------------------- a position's owner (thesis attachment)

export const PositionOwnerDocument = defineDocument<{ chainId: number; id: string }>()(
  "PositionOwner",
  `query PositionOwner($chainId: Int!, $id: String!) {
    Position(where: { chainId: { _eq: $chainId }, id: { _eq: $id } }, limit: 1) { id user_id market { id } }
  }`,
  z
    .object({
      Position: z.array(z.object({ id: z.string(), user_id: z.string(), market: z.object({ id: z.string() }) })),
    })
    .transform((d) => d.Position[0] ?? null),
);

export type FeedFills = ResultOf<typeof FeedFillsDocument>;
export type PositionOwner = ResultOf<typeof PositionOwnerDocument>;
