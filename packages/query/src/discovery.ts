/** Selected-network Perpl quotes and trade candles; calculated-equity feed discovery stays on Mainnet. */
import {
  type CalculatedEquityInstrument,
  DISCOVERY_INSTRUMENTS,
  type DiscoveryId,
  type DiscoveryInstrument,
  discoveryInstrument,
  MAINNET_CHAIN_ID,
  PERPL_EXCHANGE,
  PERPL_MARKETS,
  type PerplInstrument,
} from "@senryo/config";
import type { Reading } from "@senryo/core";
import type { CandleInterval } from "@senryo/indexer-client";
import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { DISCOVERY_CANDLES_REFETCH_MS, DISCOVERY_QUOTES_REFETCH_MS } from "./constants.ts";
import { fetchFeedCandles, fetchFeedQuotes } from "./discovery-feeds.ts";
import { fetchPerplCandles, fetchPerplQuotes } from "./discovery-perpl.ts";
import type { DiscoveryCandles, DiscoveryQuote, DiscoveryQuoteResult } from "./discovery-types.ts";
import { useQueryEnv } from "./env.tsx";
import { keys } from "./keys.ts";
import { perplReadOf } from "./perpl.ts";
import { readingOf } from "./reading.ts";
import { mainnetReadOf } from "./spot.ts";

const MS_PER_SECOND = 1000;
const STREAM_MAX_AGE_MS = 30_000;
const isPerpl = (i: DiscoveryInstrument): i is PerplInstrument => i.class === "crypto";
const isFeed = (i: DiscoveryInstrument): i is CalculatedEquityInstrument => i.class === "equity-calculated";

function itemReading(group: Reading<DiscoveryQuoteResult[]>, id: DiscoveryId): Reading<DiscoveryQuote> {
  if (group.status === "unknown" || group.status === "failed") return group;
  const row = group.value.find((r) => r.id === id);
  if (!row) return { status: "failed", error: { kind: "unknown", technical: `no quote for ${id}` } };
  if ("error" in row) return { status: "failed", error: row.error };
  return { ...group, value: row.quote };
}

/**
 * Quotes for `ids` (all discovery instruments by default), each its own Reading so one failed feed never blanks the
 * list. Perpl markets read together (one multicall + Perpl's ticker), the calculated feeds together (one multicall +
 * the 24 h search).
 */
export function useDiscoveryQuotes(
  ids?: readonly DiscoveryId[],
): Array<{ instrument: DiscoveryInstrument; reading: Reading<DiscoveryQuote> }> {
  const env = useQueryEnv();
  useSyncExternalStore(env.perplPrices.subscribe, env.perplPrices.getVersion, env.perplPrices.getVersion);
  const instruments = ids
    ? ids.map(discoveryInstrument).filter((i): i is DiscoveryInstrument => i !== undefined)
    : DISCOVERY_INSTRUMENTS;
  const selected = instruments.flatMap<DiscoveryInstrument>((i) => {
    if (!isPerpl(i)) return [i];
    const marketId = PERPL_MARKETS[env.chainId]?.[i.symbol];
    if (marketId === undefined) return [];
    const api = env.chainId === MAINNET_CHAIN_ID ? "https://app.perpl.xyz/api" : "https://testnet.perpl.xyz/api";
    return [
      {
        ...i,
        perplMarketId: marketId,
        sources: {
          ...i.sources,
          price: {
            ...i.sources.price,
            where: `Perpl Exchange ${PERPL_EXCHANGE[env.chainId]} on Monad ${env.chainId === MAINNET_CHAIN_ID ? "Mainnet" : "Testnet"}`,
          },
          change24h: { ...i.sources.change24h, where: `${api}/v1/market-data/ticker` },
          history: { ...i.sources.history, where: `${api}/v1/market-data/:id/candles/:resolution/:from-:to` },
        },
      },
    ];
  });
  const perpl = selected.filter(isPerpl);
  const feeds = selected.filter(isFeed);
  const perplQuery = useQuery({
    queryKey: [...keys.discoveryQuotes("perpl", perpl.map((i) => i.id).join(",")), env.chainId],
    queryFn: ({ signal }) => fetchPerplQuotes(perplReadOf(env), perpl, signal, env.chainId),
    enabled: perpl.length > 0,
    refetchInterval: DISCOVERY_QUOTES_REFETCH_MS,
    staleTime: DISCOVERY_QUOTES_REFETCH_MS,
  });
  const feedQuery = useQuery({
    queryKey: keys.discoveryQuotes("feeds", feeds.map((i) => i.id).join(",")),
    queryFn: () => fetchFeedQuotes(mainnetReadOf(env), feeds),
    enabled: feeds.length > 0,
    refetchInterval: DISCOVERY_QUOTES_REFETCH_MS,
    staleTime: DISCOVERY_QUOTES_REFETCH_MS,
  });
  const perplReading = readingOf(perplQuery, DISCOVERY_QUOTES_REFETCH_MS);
  const feedReading = readingOf(feedQuery, DISCOVERY_QUOTES_REFETCH_MS);
  return selected.map((instrument) => {
    const reading = itemReading(isPerpl(instrument) ? perplReading : feedReading, instrument.id);
    const tick = isPerpl(instrument) ? env.perplPrices.get(instrument.perplMarketId) : undefined;
    if (
      tick &&
      (reading.status === "fresh" || reading.status === "stale") &&
      tick.at >= reading.value.updatedAt * MS_PER_SECOND &&
      Date.now() - tick.at < STREAM_MAX_AGE_MS
    ) {
      return {
        instrument,
        reading: {
          ...reading,
          value: { ...reading.value, price18: tick.price18, updatedAt: Math.floor(tick.at / MS_PER_SECOND) },
        },
      };
    }
    return { instrument, reading };
  });
}

/** One instrument's quote (the market detail screen). */
export function useDiscoveryQuote(id: DiscoveryId): Reading<DiscoveryQuote> {
  return useDiscoveryQuotes([id])[0]?.reading ?? { status: "failed", error: { kind: "unknown", technical: id } };
}

/**
 * Chart candles for `interval` (5 m … 1 d): Perpl's trade candles, or OHLC built from a calculated feed's rounds —
 * the indexer's once it indexes these feeds, onchain rounds until then. Never interpolated: no trade or round in an
 * interval, no candle.
 */
export function useDiscoveryCandles(
  id: DiscoveryId | undefined,
  interval: CandleInterval,
  enabled = true,
): Reading<DiscoveryCandles> {
  const env = useQueryEnv();
  const original = id ? discoveryInstrument(id) : undefined;
  const instrument =
    original && isPerpl(original)
      ? { ...original, perplMarketId: PERPL_MARKETS[env.chainId]?.[original.symbol] ?? original.perplMarketId }
      : original;
  const query = useQuery({
    queryKey: [...keys.discoveryCandles(id ?? "", interval), instrument && isPerpl(instrument) ? env.chainId : "feed"],
    queryFn: ({ signal }) => {
      if (!instrument) throw new Error(`unknown discovery instrument ${id}`);
      const read = mainnetReadOf(env);
      return isPerpl(instrument)
        ? fetchPerplCandles(perplReadOf(env), instrument, interval, signal, env.chainId)
        : fetchFeedCandles(read, instrument, interval, env.indexer, signal);
    },
    enabled: enabled && instrument !== undefined,
    refetchInterval: DISCOVERY_CANDLES_REFETCH_MS,
    staleTime: DISCOVERY_CANDLES_REFETCH_MS,
  });
  return readingOf(query, DISCOVERY_CANDLES_REFETCH_MS);
}
