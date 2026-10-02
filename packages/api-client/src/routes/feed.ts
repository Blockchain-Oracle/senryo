import { z } from "zod";
import { addressSchema, chainIdSchema, isoTimeSchema } from "../primitives.ts";
import { FEED_PAGE_MAX, SEARCH_KINDS, SEARCH_QUERY_MAX_CHARS } from "../social.ts";
import { defineRoute } from "./define.ts";
import { idCursorSchema, marketIdSchema, postSchema, socialIdentitySchema } from "./posts.ts";
import { feedTradeSchema } from "./trade.ts";

/**
 * Trade feed (S12b.4, D-174, §5.9): indexed fills of accounts that share that network's trades, merged with theses.
 * Newest first, keyset on the feed row id. `scope=friends` = accounts the session follows (needs a session).
 * A fill appears only while its trader is listed AND shares trades on that network, and only from the moment they
 * turned sharing on. With a session, accounts blocked either way, muted accounts and posts you reported are left out.
 * Kinds stay separate: `position` (opened / closed / liquidated / flipped), `fill` (size added or reduced) and
 * `thesis` (authored; replies live in the thread). Following is not copy trading.
 * Every row takes every post verb (F-D1): a trade row is liked, replied to, shared and reported through its trade
 * post, an anchor created on first use (`POST /v1/feed/:id/anchor`); `engagement` carries its counts meanwhile.
 */

export const FEED_SCOPES = ["global", "friends"] as const;
export const FEED_KINDS = ["fill", "position", "thesis"] as const;

export const feedQuerySchema = z.object({
  chainId: z.coerce.number().pipe(chainIdSchema),
  scope: z.enum(FEED_SCOPES).default("global"),
  /** Indexer market id: only that market's fills and theses (the market detail Feed tab). */
  market: marketIdSchema.optional(),
  actor: addressSchema.optional(),
  cursor: idCursorSchema.optional(),
  limit: z.coerce.number().int().positive().max(FEED_PAGE_MAX).optional(),
});

export const tradeEngagementSchema = z.object({
  postId: z.uuid().nullable(),
  likes: z.int().nonnegative(),
  replies: z.int().nonnegative(),
  likedByMe: z.boolean(),
});

export const feedItemSchema = z.object({
  /** Keyset cursor of this row. */
  id: idCursorSchema,
  kind: z.enum(FEED_KINDS),
  chainId: chainIdSchema,
  /** When it happened (fill block time; thesis creation). */
  at: isoTimeSchema,
  actor: socialIdentitySchema,
  marketId: marketIdSchema.nullable(),
  trade: feedTradeSchema.nullable(),
  post: postSchema.nullable(),
  /**
   * A trade row's likes and replies, through its trade post (null on a thesis row, whose `post` carries them).
   * `postId` is null until someone first engages; then it is the thread and the like target.
   */
  engagement: tradeEngagementSchema.nullable().default(null),
});

export const feedPageSchema = z.object({
  items: z.array(feedItemSchema),
  nextCursor: idCursorSchema.nullable(),
});

export const feedRoute = defineRoute({
  method: "GET",
  path: "/v1/feed",
  auth: "optional",
  params: undefined,
  query: feedQuerySchema,
  body: undefined,
  response: feedPageSchema,
});

export const feedEventParamsSchema = z.object({ id: idCursorSchema });

/**
 * F-D1: a trade row's post, created on first use and the same one ever after (one per feed row). Its id is what likes,
 * replies (`parentId`), reports and share links use; its thread carries the trade. 404 when the row isn't visible on
 * its network (the trader unlisted, stopped sharing, or it is a thesis row, which is its own post).
 */
export const tradeAnchorRoute = defineRoute({
  method: "POST",
  path: "/v1/feed/:id/anchor",
  auth: "optional",
  params: feedEventParamsSchema,
  query: undefined,
  body: undefined,
  response: postSchema,
});

/**
 * Global search (S12b.7): markets (our engine's listings on that network), tokens (the J11 spot list, mainnet
 * pools, either network) and traders (profiles listed on that network; handle prefix, or an exact address). `kind`
 * omitted = all.
 */
export const searchQuerySchema = z.object({
  chainId: z.coerce.number().pipe(chainIdSchema),
  q: z.string().trim().min(1).max(SEARCH_QUERY_MAX_CHARS),
  kind: z.enum(SEARCH_KINDS).optional(),
});

export const searchMarketSchema = z.object({
  /** Indexer market id (`ours-0`). */
  id: marketIdSchema,
  engineId: z.int().nonnegative(),
  symbol: z.string(),
  /** Display pair in the feed's orientation (`XAU/USD`). */
  pair: z.string(),
  name: z.string(),
  category: z.enum(["metal", "fx"]),
  venue: z.literal("SENRYO"),
});

export const searchTokenSchema = z.object({ symbol: z.string(), name: z.string(), address: addressSchema });

/** A trader listed on the queried network. */
export const searchTraderSchema = socialIdentitySchema;

export const searchResultSchema = z.object({
  q: z.string(),
  markets: z.array(searchMarketSchema),
  tokens: z.array(searchTokenSchema),
  traders: z.array(searchTraderSchema),
});

export const searchRoute = defineRoute({
  method: "GET",
  path: "/v1/search",
  auth: "optional",
  params: undefined,
  query: searchQuerySchema,
  body: undefined,
  response: searchResultSchema,
});

export type FeedScope = (typeof FEED_SCOPES)[number];
export type FeedKind = (typeof FEED_KINDS)[number];
export type FeedQuery = z.output<typeof feedQuerySchema>;
export type FeedItem = z.output<typeof feedItemSchema>;
export type TradeEngagement = z.output<typeof tradeEngagementSchema>;
export type FeedPage = z.output<typeof feedPageSchema>;
export type SearchKind = (typeof SEARCH_KINDS)[number];
export type SearchResult = z.output<typeof searchResultSchema>;
export type SearchMarket = z.output<typeof searchMarketSchema>;
export type SearchTrader = z.output<typeof searchTraderSchema>;
