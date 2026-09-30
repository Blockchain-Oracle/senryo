/**
 * Chart data and sync status. Candles exist only for intervals with a real oracle round or fill (D-020: no
 * fabricated ticks) — the chart draws the gaps. `_meta` backs "wait until indexed" after a transaction.
 */
import { z } from "zod";
import { defineDocument, type ResultOf } from "../client.ts";
import { type CandleInterval, PAGE_SIZE } from "../constants.ts";
import { bigintish, marketStatus, optionalBigint, optionalInt, venue } from "../scalars.ts";
import { META_FIELDS, meta } from "./fragments.ts";

interface CandleVars {
  chainId: number;
  feed: string;
  interval: number;
  since: number;
  limit: number;
}

const candle = z.object({
  openTime: z.number().int(),
  open: bigintish,
  high: bigintish,
  low: bigintish,
  close: bigintish,
  roundCount: z.number().int(),
  fillCount: z.number().int(),
  volume: bigintish,
});
export type IndexedCandle = z.infer<typeof candle>;

export const CandlesDocument = defineDocument<CandleVars>()(
  "Candles",
  `query Candles($chainId: Int!, $feed: String!, $interval: Int!, $since: Int!, $limit: Int!) {
    Candle(
      where: { chainId: { _eq: $chainId }, feed_id: { _eq: $feed }, interval: { _eq: $interval }, openTime: { _gte: $since } }
      order_by: { openTime: desc }
      limit: $limit
    ) { openTime open high low close roundCount fillCount volume }
  }`,
  z.object({ Candle: z.array(candle) }).transform((d) => [...d.Candle].reverse()),
);

/** Oldest → newest candles of one asset feed ("XAU", "XAG"). */
export function candlesVars(
  chainId: number,
  feed: string,
  interval: CandleInterval,
  opts: { since?: number; limit?: number } = {},
): CandleVars {
  return { chainId, feed, interval, since: opts.since ?? 0, limit: opts.limit ?? PAGE_SIZE.candles };
}

// ---------------------------------------------------------------- markets + feeds (session status, oracle age)

const market = z.object({
  id: z.string(),
  venue,
  symbol: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  status: marketStatus,
  statusSince: optionalInt,
  lastPrice: optionalBigint,
  lastPriceAt: optionalInt,
  longSize: bigintish,
  shortSize: bigintish,
  fundingRate: bigintish,
  borrowRate: bigintish,
  volume: bigintish,
  tradeCount: z.number().int(),
  feed: z
    .object({
      id: z.string(),
      latestPrice: bigintish,
      latestUpdatedAt: z.number().int(),
      roundCount: z.number().int(),
    })
    .nullable(),
});
export type IndexedMarket = z.infer<typeof market>;

export const OurMarketsDocument = defineDocument<{ chainId: number }>()(
  "OurMarkets",
  `query OurMarkets($chainId: Int!) {
    Market(where: { chainId: { _eq: $chainId }, venue: { _eq: "OURS" } }, order_by: { marketIndex: asc }) {
      id venue symbol name enabled status statusSince lastPrice lastPriceAt longSize shortSize fundingRate borrowRate
      volume tradeCount feed { id latestPrice latestUpdatedAt roundCount }
    }
  }`,
  z.object({ Market: z.array(market) }).transform((d) => d.Market),
);

// ---------------------------------------------------------------- indexer progress

export const MetaDocument = defineDocument<Record<string, never>>()(
  "Meta",
  `query Meta { _meta { ${META_FIELDS} } }`,
  z.object({ _meta: z.array(meta) }).transform((d) => d._meta),
);

/** True once the indexer has processed `block` on `chainId` (poll after a receipt, then refetch). */
export function isIndexed(metas: ResultOf<typeof MetaDocument>, chainId: number, block: bigint | number): boolean {
  const row = metas.find((m) => m.chainId === chainId);
  return row !== undefined && BigInt(row.progressBlock) >= BigInt(block);
}

export type Candles = ResultOf<typeof CandlesDocument>;
export type OurMarkets = ResultOf<typeof OurMarketsDocument>;
