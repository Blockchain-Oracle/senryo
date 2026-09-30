/**
 * One engine market as the watchlist and the trade header show it: the live oracle view (block read + socket ticks),
 * the 24 h change and sparkline from hourly Chainlink candles (D-163), max leverage from the market's IM, and the
 * oracle age. Candles failing never blanks the price — change/spark are then simply absent.
 */
import type { MarketStatus, Reading } from "@senryo/core";
import { RISK } from "@senryo/core";
import { type LiveMarket, useCandles, useMarket } from "@senryo/query";
import { toPlot } from "~/lib/money";

const HOUR_INTERVAL = 3_600;
const DAY_SEC = 86_400n;
const SPARK_HOURS = 24;
const PRICE_DECIMALS = 18;
const MS_PER_SECOND = 1000n;

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
  spark: number[];
  market: LiveMarket;
}

export function useMarketLine(marketId: number, symbol: string): Reading<MarketLine> {
  const market = useMarket(marketId);
  const candles = useCandles(symbol, HOUR_INTERVAL);
  if (market.status === "unknown" || market.status === "failed") return market;
  const m = market.value;
  const nowSec = BigInt(Date.now()) / MS_PER_SECOND;
  const rows = candles.status === "fresh" || candles.status === "stale" ? candles.value : [];
  const dayAgo = [...rows].reverse().find((c) => BigInt(c.openTime) <= nowSec - DAY_SEC);
  const ref = dayAgo?.close;
  const change24hBps = ref && ref > 0n ? ((m.pv.price18 - ref) * RISK.BPS) / ref : undefined;
  const spark = rows.slice(-SPARK_HOURS).map((c) => toPlot(c.close, PRICE_DECIMALS));
  return {
    ...market,
    value: {
      marketId,
      symbol: m.symbol,
      name: m.name,
      status: m.pv.status,
      price18: m.pv.price18,
      updatedAt: m.updatedAt,
      maxLeverageX: m.maxLeverageX,
      change24hBps,
      spark,
      market: m,
    },
  };
}
