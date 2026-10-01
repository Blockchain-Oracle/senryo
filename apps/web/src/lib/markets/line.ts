"use client";

/**
 * One engine market as the watchlist and the trade header show it (the phone's `useMarketLine`): the live oracle view
 * (block read + socket ticks), the 24 h change and sparkline from hourly Chainlink candles (D-163), max leverage from
 * the market's IM, and the oracle age. Candles failing never blanks the price — change/spark are then simply absent.
 * `useMarketLines` is the list form (one hook for every listed market, so the watchlist can sort by change).
 */
import { type EngineMarket, engineMarketsOn, MAINNET_CHAIN_ID } from "@senryo/config";
import { fromQuery, type MarketStatus, type Reading, RISK, toPlot } from "@senryo/core";
import { type CandleInterval, type Candles, CandlesDocument, candlesVars } from "@senryo/indexer-client";
import {
  CANDLE_WINDOW_SEC,
  CANDLES_REFETCH_MS,
  keys,
  type LiveMarket,
  type QueryEnv,
  STALE_AFTER_INTERVALS,
  useCandles,
  useMarket,
  useMarkets,
  useQueryEnv,
} from "@senryo/query";
import { queryOptions, useQueries } from "@tanstack/react-query";

const HOUR_INTERVAL: CandleInterval = 3_600;
const DAY_SEC = 86_400n;
const SPARK_HOURS = 24;
const PRICE_DECIMALS = 18;
const MS_PER_SECOND = 1000;

export interface MarketLine {
  marketId: number;
  symbol: string;
  name: string;
  status: MarketStatus;
  price18: bigint;
  /** Oracle round time (unix s). */
  updatedAt: bigint;
  maxLeverageX: number;
  change24hBps: bigint | undefined;
  /** Plot-only closes of the last 24 hourly candles. */
  spark: number[];
  /** The reading behind the line: risk params, the engine's book, the price view. */
  market: LiveMarket;
}

/**
 * The hourly candles `useCandles` reads, as options for `useQueries` — the same key and document, so the list and the
 * trade page share one cache entry per market.
 */
const hourlyCandles = (env: QueryEnv, symbol: string) =>
  queryOptions({
    queryKey: keys.candles(MAINNET_CHAIN_ID, symbol, HOUR_INTERVAL),
    queryFn: ({ signal }) => {
      const since = Math.floor(Date.now() / MS_PER_SECOND) - CANDLE_WINDOW_SEC[HOUR_INTERVAL];
      return env.indexer.request(
        CandlesDocument,
        candlesVars(MAINNET_CHAIN_ID, symbol, HOUR_INTERVAL, { since }),
        signal,
      );
    },
    refetchInterval: CANDLES_REFETCH_MS,
    staleTime: CANDLES_REFETCH_MS,
  });

function lineOf(market: Reading<LiveMarket>, candles: Reading<Candles>): Reading<MarketLine> {
  if (market.status === "unknown" || market.status === "failed") return market;
  const m = market.value;
  const nowSec = BigInt(Math.floor(Date.now() / MS_PER_SECOND));
  const rows = candles.status === "fresh" || candles.status === "stale" ? candles.value : [];
  const dayAgo = [...rows].reverse().find((c) => BigInt(c.openTime) <= nowSec - DAY_SEC);
  const ref = dayAgo?.close;
  const change24hBps = ref && ref > 0n ? ((m.pv.price18 - ref) * RISK.BPS) / ref : undefined;
  return {
    ...market,
    value: {
      marketId: m.marketId,
      symbol: m.symbol,
      name: m.name,
      status: m.pv.status,
      price18: m.pv.price18,
      updatedAt: m.updatedAt,
      maxLeverageX: m.maxLeverageX,
      change24hBps,
      spark: rows.slice(-SPARK_HOURS).map((c) => toPlot(c.close, PRICE_DECIMALS)),
      market: m,
    },
  };
}

export function useMarketLine(marketId: number, symbol: string): Reading<MarketLine> {
  return lineOf(useMarket(marketId), useCandles(symbol, HOUR_INTERVAL));
}

export type MarketLines = Array<{ meta: EngineMarket; reading: Reading<MarketLine> }>;

/** Every engine market listed on the active network, each with its own Reading (one failing read never blanks the list). */
export function useMarketLines(): MarketLines {
  const env = useQueryEnv();
  const listed = engineMarketsOn(env.chainId);
  const markets = useMarkets();
  const candles = useQueries({ queries: listed.map((m) => hourlyCandles(env, m.symbol)) });
  return listed.map((meta, i) => {
    const market = markets[i]?.reading ?? ({ status: "unknown" } as const);
    const query = candles[i];
    // The query layer's stale rule (missed refetches, or a failed refresh) — `readingOf` in @senryo/query.
    const candle: Reading<Candles> = query
      ? fromQuery(query, { now: Date.now(), staleAfterMs: CANDLES_REFETCH_MS * STALE_AFTER_INTERVALS })
      : { status: "unknown" };
    return { meta, reading: lineOf(market, candle) };
  });
}
