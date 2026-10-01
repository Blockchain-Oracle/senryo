import { z } from "zod";
import { chainIdSchema, intCodec, uintCodec, unixSecondsSchema } from "../primitives.ts";
import { defineRoute } from "./define.ts";
import { socialIdentitySchema } from "./posts.ts";

/**
 * Market Holders (FT098): the open positions in one of our engine's markets, of accounts listed on that network that
 * share its trades, largest first by notional at the market's accepted oracle price (`/v1/markets` `price18`), at
 * most `MARKET_HOLDERS_MAX`. Senryo is cross-margin, so a position has no leverage multiple of its own — size,
 * entry, notional and price-move P&L only. With a session, accounts blocked either way and muted accounts are left
 * out; `friends=true` keeps only accounts the session follows (needs a session). Indexer or price unavailable →
 * 503 UPSTREAM_UNAVAILABLE (never an empty list that reads as "nobody holds it"); a market not listed on that
 * network → 404 NOT_FOUND.
 */

export const marketHoldersParamsSchema = z.object({ marketId: z.coerce.number().int().nonnegative() });

export const marketHoldersQuerySchema = z.object({
  chainId: z.coerce.number().pipe(chainIdSchema),
  friends: z.stringbool().default(false),
});

/** The holder's identity (`address` lower-case) and position. */
export const marketHolderSchema = socialIdentitySchema.extend({
  isLong: z.boolean(),
  /** Position size in base units (1e18), unsigned. */
  size18: uintCodec,
  /** Average entry price (1e18). */
  entry18: uintCodec,
  /** |size| × mark (usd6, rounded up as the engine does). */
  notionalUsd6: uintCodec,
  /** Unrealised P&L at mark (usd6, signed): the price move only — no funding, borrow or fees. */
  upnlUsd6: intCodec,
  openedAt: unixSecondsSchema,
});

export const marketHoldersSchema = z.object({
  chainId: chainIdSchema,
  marketId: z.int().nonnegative(),
  /** The accepted oracle price notional and P&L use (1e18). */
  mark18: uintCodec,
  /** When that price was accepted (unix seconds). */
  markUpdatedAt: unixSecondsSchema,
  holders: z.array(marketHolderSchema),
  /** Sharing holders beyond the returned list (0 when all are shown). */
  more: z.int().nonnegative(),
});

export const marketHoldersRoute = defineRoute({
  method: "GET",
  path: "/v1/markets/:marketId/holders",
  auth: "optional",
  params: marketHoldersParamsSchema,
  query: marketHoldersQuerySchema,
  body: undefined,
  response: marketHoldersSchema,
});

export type MarketHolder = z.output<typeof marketHolderSchema>;
export type MarketHolders = z.output<typeof marketHoldersSchema>;
