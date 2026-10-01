import { z } from "zod";
import { chainIdSchema, intCodec, isoTimeSchema, txHashSchema, uintCodec } from "../primitives.ts";
import { LEADERBOARD_PAGE_MAX, LEADERBOARD_PERIODS, LEADERBOARD_SCOPES } from "../social.ts";
import { defineRoute } from "./define.ts";
import { TRADE_SIDES, TRADE_VENUES } from "./feed.ts";
import { marketIdSchema, positionIdSchema, socialIdentitySchema } from "./posts.ts";
import { chainQuerySchema } from "./profile.ts";

/**
 * Leaderboard (S12b.5, D-174, §5.9). Metric: **realized PnL after fees, funding and borrow** (usd6), per network,
 * over profiles listed on that network only. Snapshots refresh every 60 s.
 * - 24h is a rolling window over indexed fills; 7d and 30d are UTC-day buckets with today included; All is lifetime.
 * - Anti-farming floor: an account is ranked only with at least `floor.minTrades` trades AND `floor.minNotionalUsd6`
 *   traded in the window. Below it, or with no indexed activity, the rank is null — "Not ranked", never 0.
 * - `scope=following`: the accounts the session follows plus the session itself, ranked among themselves.
 */

export const LEADERBOARD_METRIC = "realized_pnl_after_fees_funding_borrow" as const;
export const STANDING_STATUSES = ["ranked", "below_floor", "no_activity", "not_listed"] as const;
export const WINDOW_KINDS = ["rolling", "utc_days", "lifetime"] as const;

export const leaderboardQuerySchema = z.object({
  chainId: z.coerce.number().pipe(chainIdSchema),
  period: z.enum(LEADERBOARD_PERIODS).default("7d"),
  scope: z.enum(LEADERBOARD_SCOPES).default("all"),
  limit: z.coerce.number().int().positive().max(LEADERBOARD_PAGE_MAX).optional(),
});

export const leaderboardEntrySchema = socialIdentitySchema.extend({
  /** Rank within the requested scope (1 = best). */
  rank: z.int().positive(),
  /** Rank on the network's full board. */
  globalRank: z.int().positive(),
  netPnlUsd6: intCodec,
  notionalUsd6: uintCodec,
  trades: z.int().nonnegative(),
  /** Up to three market symbols the trader touched in the window (the row's asset cluster). */
  markets: z.array(z.string()),
});

/** The session account's own standing; numbers are null when there is no indexed activity (never a fake 0). */
export const standingSchema = z.object({
  status: z.enum(STANDING_STATUSES),
  rank: z.int().positive().nullable(),
  globalRank: z.int().positive().nullable(),
  netPnlUsd6: intCodec.nullable(),
  notionalUsd6: uintCodec.nullable(),
  trades: z.int().nonnegative().nullable(),
});

export const leaderboardSchema = z.object({
  chainId: chainIdSchema,
  period: z.enum(LEADERBOARD_PERIODS),
  scope: z.enum(LEADERBOARD_SCOPES),
  metric: z.literal(LEADERBOARD_METRIC),
  window: z.object({
    kind: z.enum(WINDOW_KINDS),
    /** Inclusive start (rolling: now − 24h; utc_days: 00:00 UTC of the first day); null for lifetime. */
    from: isoTimeSchema.nullable(),
    to: isoTimeSchema,
  }),
  floor: z.object({ minTrades: z.int().nonnegative(), minNotionalUsd6: uintCodec }),
  computedAt: isoTimeSchema,
  entries: z.array(leaderboardEntrySchema),
  /** Null without a session. */
  you: standingSchema.nullable(),
});

/** 503 UPSTREAM_UNAVAILABLE until the first snapshot of that network exists (indexer down at start). */
export const leaderboardRoute = defineRoute({
  method: "GET",
  path: "/v1/leaderboard",
  auth: "optional",
  params: undefined,
  query: leaderboardQuerySchema,
  body: undefined,
  response: leaderboardSchema,
});

/**
 * Weekly verified Top Trades: the best closed position per trader this UTC week (Monday 00:00), from accounts listed
 * on that network that share its trades, ranked by the position's realized PnL after fees, funding and borrow.
 * "Verified" = read from the indexer (onchain events), with the closing transaction.
 */
export const topTradeSchema = z.object({
  rank: z.int().positive(),
  trader: socialIdentitySchema,
  positionId: positionIdSchema,
  marketId: marketIdSchema,
  symbol: z.string(),
  venue: z.enum(TRADE_VENUES),
  side: z.enum(TRADE_SIDES),
  netPnlUsd6: intCodec,
  /** Notional opened over the position's life (usd6). */
  notionalUsd6: uintCodec,
  openedAt: isoTimeSchema,
  closedAt: isoTimeSchema,
  closeTxHash: txHashSchema.nullable(),
});

export const topTradesSchema = z.object({
  chainId: chainIdSchema,
  weekStart: isoTimeSchema,
  computedAt: isoTimeSchema,
  items: z.array(topTradeSchema),
});

export const topTradesRoute = defineRoute({
  method: "GET",
  path: "/v1/top-trades",
  auth: "none",
  params: undefined,
  query: chainQuerySchema,
  body: undefined,
  response: topTradesSchema,
});

/** "Follow top traders": the network's 30d ranked floor, minus yourself, accounts you follow and blocks. */
export const recommendationSchema = socialIdentitySchema.extend({
  rank: z.int().positive(),
  netPnlUsd6: intCodec,
  trades: z.int().nonnegative(),
  /** Why it is suggested (shown per row). */
  reason: z.literal("top_30d"),
});

export const recommendationsSchema = z.object({
  chainId: chainIdSchema,
  items: z.array(recommendationSchema),
});

export const recommendationsRoute = defineRoute({
  method: "GET",
  path: "/v1/recommendations/follow",
  auth: "session",
  params: undefined,
  query: chainQuerySchema,
  body: undefined,
  response: recommendationsSchema,
});

export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];
export type LeaderboardScope = (typeof LEADERBOARD_SCOPES)[number];
export type StandingStatus = (typeof STANDING_STATUSES)[number];
export type LeaderboardEntry = z.output<typeof leaderboardEntrySchema>;
export type Standing = z.output<typeof standingSchema>;
export type Leaderboard = z.output<typeof leaderboardSchema>;
export type TopTrade = z.output<typeof topTradeSchema>;
export type TopTrades = z.output<typeof topTradesSchema>;
export type Recommendation = z.output<typeof recommendationSchema>;
