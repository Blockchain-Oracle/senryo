/**
 * Market reads for Markets, the market screen and the ticket: params + book + oracle from one block
 * (`readMarketRisk`, re-read every few seconds) with the socket's newer price ticks laid over the oracle view;
 * the session calendar (display only); candles from the Envio indexer.
 */
import { type MarketRiskSnapshot, readCalendar, readMarketRisk } from "@senryo/chain";
import { type ChainId, ENGINE_MARKETS, MAINNET_CHAIN_ID } from "@senryo/config";
import { fromQuery, type Reading, type WeekCalendar } from "@senryo/core";
import { type CandleInterval, type Candles, CandlesDocument, candlesVars } from "@senryo/indexer-client";
import { queryOptions, useQueries, useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import {
  CALENDAR_STALE_MS,
  CANDLE_WINDOW_SEC,
  CANDLES_REFETCH_MS,
  MARKET_REFETCH_MS,
  PRICE_STALE_MS,
} from "./constants.ts";
import { type QueryEnv, useQueryEnv } from "./env.tsx";
import { keys } from "./keys.ts";
import { PriceStore, type PriceTick } from "./price-store.ts";

const MS_PER_SECOND = 1000;

export const marketRiskOptions = (env: QueryEnv, marketId: number) =>
  queryOptions({
    queryKey: keys.marketRisk(env.chainId, marketId),
    queryFn: () => readMarketRisk(env.read, env.chainId, marketId, "latest"),
    refetchInterval: MARKET_REFETCH_MS,
    staleTime: MARKET_REFETCH_MS,
  });

/** The latest socket tick for a symbol on the active network (re-renders once per animation frame at most). */
export function usePriceTick(symbol: string): PriceTick | undefined {
  const env = useQueryEnv();
  return useSyncExternalStore(
    env.prices.subscribe,
    () => env.prices.get(env.chainId, symbol),
    () => undefined,
  );
}

export interface LiveMarket extends MarketRiskSnapshot {
  symbol: string;
  name: string;
  /** The price shown is a socket tick newer than the block read. */
  live: boolean;
  /** No tick within `PRICE_STALE_MS` and the socket is quiet — the UI says "updated …". */
  tickStale: boolean;
}

function overlay(snapshot: MarketRiskSnapshot, tick: PriceTick | undefined, now: number): LiveMarket {
  const meta = ENGINE_MARKETS.find((m) => m.id === snapshot.marketId);
  const base = { ...snapshot, symbol: meta?.symbol ?? String(snapshot.marketId), name: meta?.name ?? "" };
  if (!tick || tick.updatedAt < snapshot.updatedAt) return { ...base, live: false, tickStale: true };
  return {
    ...base,
    pv: { price18: tick.price18, latest18: tick.latest18, status: tick.status, spreadBps: tick.spreadBps },
    updatedAt: tick.updatedAt,
    live: true,
    tickStale: now - tick.receivedAt > PRICE_STALE_MS,
  };
}

function mapReading<T, U>(reading: Reading<T>, map: (value: T) => U): Reading<U> {
  if (reading.status === "unknown" || reading.status === "failed") return reading;
  return { ...reading, value: map(reading.value) };
}

export function useMarket(marketId: number): Reading<LiveMarket> {
  const env = useQueryEnv();
  const symbol = ENGINE_MARKETS.find((m) => m.id === marketId)?.symbol ?? "";
  const tick = usePriceTick(symbol);
  const query = useQuery(marketRiskOptions(env, marketId));
  return mapReading(fromQuery(query), (s) => overlay(s, tick, Date.now()));
}

/** Every engine market (Markets screen), each its own Reading so one failing read never blanks the list. */
export function useMarkets(): Array<{ symbol: string; reading: Reading<LiveMarket> }> {
  const env = useQueryEnv();
  const queries = useQueries({ queries: ENGINE_MARKETS.map((m) => marketRiskOptions(env, m.id)) });
  const ticks = useSyncExternalStore(env.prices.subscribe, env.prices.all, env.prices.all);
  const snapshotAt = Date.now();
  return ENGINE_MARKETS.map((m, i) => {
    const query = queries[i];
    const reading = query ? fromQuery(query) : ({ status: "unknown" } as const);
    return {
      symbol: m.symbol,
      reading: mapReading(reading, (s) => overlay(s, ticks.get(PriceStore.key(env.chainId, m.symbol)), snapshotAt)),
    };
  });
}

export function useCalendar(calendarId: number | undefined): Reading<WeekCalendar> {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: keys.calendar(env.chainId, calendarId ?? -1),
    queryFn: () => readCalendar(env.read, env.chainId, calendarId ?? 0),
    enabled: calendarId !== undefined,
    staleTime: CALENDAR_STALE_MS,
  });
  return fromQuery(query);
}

/**
 * Candles for a metal (D-020, D-163): Chainlink rounds indexed on **Monad mainnet** for both modes — the practice
 * mirror relays that same feed, so practice charts show the real market (labelled "Chainlink XAU/USD · Monad").
 */
export function useCandles(symbol: string, interval: CandleInterval): Reading<Candles> {
  const env = useQueryEnv();
  const feedChain: ChainId = MAINNET_CHAIN_ID;
  const query = useQuery({
    queryKey: keys.candles(feedChain, symbol, interval),
    queryFn: ({ signal }) => {
      const since = Math.floor(Date.now() / MS_PER_SECOND) - CANDLE_WINDOW_SEC[interval];
      return env.indexer.request(CandlesDocument, candlesVars(feedChain, symbol, interval, { since }), signal);
    },
    refetchInterval: CANDLES_REFETCH_MS,
    staleTime: CANDLES_REFETCH_MS,
  });
  return fromQuery(query);
}
