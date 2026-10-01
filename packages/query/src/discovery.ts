/**
 * Read-only discovery (review S03): live price, 24 h change, market stats and a chart for instruments that don't trade
 * here yet — Perpl's crypto perps and the Chainlink calculated tokenized-equity feeds (`DISCOVERY_INSTRUMENTS`). Every
 * read goes to Monad mainnet whichever mode is selected (`mainnetReadOf`); each instrument's `execution` says why it
 * doesn't trade on the active network. Types: `./discovery-types.ts`.
 */
import {
  type CalculatedEquityInstrument,
  DISCOVERY_INSTRUMENTS,
  type DiscoveryId,
  type DiscoveryInstrument,
  discoveryInstrument,
  type PerplInstrument,
} from "@senryo/config";
import type { Reading } from "@senryo/core";
import type { CandleInterval } from "@senryo/indexer-client";
import { useQuery } from "@tanstack/react-query";
import { DISCOVERY_CANDLES_REFETCH_MS, DISCOVERY_QUOTES_REFETCH_MS } from "./constants.ts";
import { fetchFeedCandles, fetchFeedQuotes } from "./discovery-feeds.ts";
import { fetchPerplCandles, fetchPerplQuotes } from "./discovery-perpl.ts";
import type { DiscoveryCandles, DiscoveryQuote, DiscoveryQuoteResult } from "./discovery-types.ts";
import { useQueryEnv } from "./env.tsx";
import { keys } from "./keys.ts";
import { readingOf } from "./reading.ts";
import { mainnetReadOf } from "./spot.ts";

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
  const instruments = ids
    ? ids.map(discoveryInstrument).filter((i): i is DiscoveryInstrument => i !== undefined)
    : DISCOVERY_INSTRUMENTS;
  const perpl = instruments.filter(isPerpl);
  const feeds = instruments.filter(isFeed);
  const perplQuery = useQuery({
    queryKey: keys.discoveryQuotes("perpl", perpl.map((i) => i.id).join(",")),
    queryFn: ({ signal }) => fetchPerplQuotes(mainnetReadOf(env), perpl, signal),
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
  return instruments.map((instrument) => ({
    instrument,
    reading: itemReading(isPerpl(instrument) ? perplReading : feedReading, instrument.id),
  }));
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
export function useDiscoveryCandles(id: DiscoveryId | undefined, interval: CandleInterval): Reading<DiscoveryCandles> {
  const env = useQueryEnv();
  const instrument = id ? discoveryInstrument(id) : undefined;
  const query = useQuery({
    queryKey: keys.discoveryCandles(id ?? "", interval),
    queryFn: ({ signal }) => {
      if (!instrument) throw new Error(`unknown discovery instrument ${id}`);
      const read = mainnetReadOf(env);
      return isPerpl(instrument)
        ? fetchPerplCandles(read, instrument, interval, signal)
        : fetchFeedCandles(read, instrument, interval, env.indexer, signal);
    },
    enabled: instrument !== undefined,
    refetchInterval: DISCOVERY_CANDLES_REFETCH_MS,
    staleTime: DISCOVERY_CANDLES_REFETCH_MS,
  });
  return readingOf(query, DISCOVERY_CANDLES_REFETCH_MS);
}
