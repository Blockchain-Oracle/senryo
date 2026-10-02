import { z } from "zod";
import { intCodec, txHashSchema, uintCodec } from "../primitives.ts";
import { POSITION_ID_PATTERN } from "../social.ts";

/**
 * One indexed fill as the social layer shows it (S12b.4): a feed row's trade, and the trade a trade post's thread is
 * about (F-D1). Its own module so posts (threads) and the feed can both use it without importing each other.
 * Enums mirror indexer `FillKind` / `Side` / `Venue` / `PositionStatus` (indexer/schema.graphql).
 */

export const TRADE_FILL_KINDS = [
  "OPEN",
  "INCREASE",
  "DECREASE",
  "CLOSE",
  "LIQUIDATE",
  "TRIGGER",
  "INVERT",
  "DELEVERAGE",
] as const;
export const TRADE_SIDES = ["LONG", "SHORT"] as const;
export const TRADE_VENUES = ["OURS", "PERPL"] as const;
export const POSITION_STATUSES = ["OPEN", "CLOSED", "LIQUIDATED"] as const;

/** Indexer position ids (`ours-0-0xabc…-123_4`, `perpl-16-7-123_4`). */
export const positionIdSchema = z.string().regex(POSITION_ID_PATTERN, "expected an indexer position id");

/** One indexed fill (usd6 money, 1e18 size/price). `realizedPnl` is before fees, funding and borrow. */
export const feedTradeSchema = z.object({
  venue: z.enum(TRADE_VENUES),
  fillKind: z.enum(TRADE_FILL_KINDS),
  side: z.enum(TRADE_SIDES),
  symbol: z.string(),
  size: uintCodec,
  price: uintCodec.nullable(),
  notional: uintCodec,
  fee: uintCodec,
  realizedPnl: intCodec,
  funding: intCodec,
  borrow: uintCodec,
  positionId: positionIdSchema,
  positionStatus: z.enum(POSITION_STATUSES).nullable(),
  /** A closed / liquidated position's lifetime realized PnL after fees, funding and borrow; null while open. */
  positionNetPnl: intCodec.nullable(),
  txHash: txHashSchema,
  block: z.int().nonnegative(),
});

export type FeedTrade = z.output<typeof feedTradeSchema>;
