/**
 * Perpl crypto perps, read-only (review S03). The price is Perpl's own Exchange state on mainnet — mark price and
 * time, open interest, last funding rate (`readPerplMarkets`) — so it shows wherever an RPC answers. Perpl's keyless
 * REST adds what the chain doesn't keep: the 24 h change (last trade vs `prv`, the formula Perpl's own app uses), 24 h
 * volume, funding intervals and trade candles. If that API doesn't answer (outage, or a browser origin its CORS
 * refuses), those fields say so and the price still shows.
 */
import { type PerplMarketInfo, type ReadClient, readPerplMarkets } from "@senryo/chain";
import { PERPL_API, PERPL_APP_URL, PERPL_MAX_CANDLES, PERPL_PRICE_SOURCE, type PerplInstrument } from "@senryo/config";
import { BPS_DENOMINATOR, DECIMALS, divRound, oneUnit, rescale } from "@senryo/core";
import type { CandleInterval } from "@senryo/indexer-client";
import { CANDLE_WINDOW_SEC, PERPL_CONTEXT_TTL_MS, PERPL_HTTP_TIMEOUT_MS } from "./constants.ts";
import {
  type DiscoveryCandles,
  type DiscoveryChange,
  type DiscoveryQuote,
  type DiscoveryQuoteResult,
  has,
  lacks,
  type Metric,
} from "./discovery-types.ts";
import type { TokenCandle } from "./spot-candles.ts";

const MS_PER_SECOND = 1000;
const DIGITS = /^\d+$/;

/** A JSON integer (Perpl sends scaled prices and sizes as numbers) → bigint; anything else is no value. */
function integer(value: unknown): bigint | undefined {
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && DIGITS.test(value)) return BigInt(value);
  return undefined;
}

/** One market's ticker fields: last trade and "price 24h ago" (scaled), daily volume (AUSD base units). */
interface TickerRow {
  lst: bigint;
  prv: bigint;
  dva: bigint | undefined;
}

const settle = <T>(p: Promise<T>): Promise<PromiseSettledResult<T>> =>
  p.then(
    (value) => ({ status: "fulfilled", value }),
    (reason: unknown) => ({ status: "rejected", reason }),
  );

/**
 * GET with a deadline, so a hung Perpl call never holds back the onchain price it is read beside. AbortController +
 * setTimeout rather than AbortSignal.timeout/any, which Hermes does not ship (as the indexer client does).
 */
async function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, PERPL_HTTP_TIMEOUT_MS);
  const forward = () => controller.abort();
  signal?.addEventListener("abort", forward);
  try {
    const res = await fetch(`${PERPL_API}${path}`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Perpl ${path}: HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    if (timedOut) throw new Error(`Perpl ${path}: no answer in ${PERPL_HTTP_TIMEOUT_MS / MS_PER_SECOND} s`);
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forward);
  }
}

/** `GET /v1/market-data/ticker` → per market id. A market Perpl has no state for yet is absent. */
async function fetchTicker(signal?: AbortSignal): Promise<Map<number, TickerRow>> {
  const body = (await getJson("/v1/market-data/ticker", signal)) as { d?: Record<string, Record<string, unknown>> };
  const out = new Map<number, TickerRow>();
  for (const [id, row] of Object.entries(body.d ?? {})) {
    const lst = integer(row.lst);
    const prv = integer(row.prv);
    if (lst === undefined || prv === undefined) continue;
    out.set(Number.parseInt(id, 10), { lst, prv, dva: integer(row.dva) });
  }
  return out;
}

let funding: { at: number; byMarket: Map<number, number> } | undefined;

/** Funding interval (s) per market from `/v1/pub/context`, re-read at most every `PERPL_CONTEXT_TTL_MS`. */
async function fundingIntervals(signal?: AbortSignal): Promise<Map<number, number>> {
  if (funding && Date.now() - funding.at < PERPL_CONTEXT_TTL_MS) return funding.byMarket;
  const body = (await getJson("/v1/pub/context", signal)) as { markets?: Array<Record<string, unknown>> };
  const byMarket = new Map<number, number>();
  for (const m of body.markets ?? []) {
    const id = integer(m.id);
    const interval = integer(m.funding_interval_sec);
    if (id !== undefined && interval !== undefined) byMarket.set(Number(id), Number(interval));
  }
  funding = { at: Date.now(), byMarket };
  return byMarket;
}

const to18 = (pns: bigint, info: PerplMarketInfo): bigint => rescale(pns, info.priceDecimals, DECIMALS.e18);

function change24h(
  row: TickerRow | undefined,
  info: PerplMarketInfo,
  tickerError: string | undefined,
): Metric<DiscoveryChange> {
  if (!row) return lacks(tickerError ?? "Perpl's ticker has no state for this market yet");
  if (row.prv === 0n) return lacks("Perpl has no price from 24 h ago for this market");
  const change: DiscoveryChange = {
    fromPrice18: to18(row.prv, info),
    fromAt: undefined,
    bps: divRound((row.lst - row.prv) * BPS_DENOMINATOR, row.prv),
    basis: "Last trade vs Perpl's price 24 h ago",
  };
  return has(change);
}

function quoteOf(
  instrument: PerplInstrument,
  info: PerplMarketInfo,
  row: TickerRow | undefined,
  intervals: Map<number, number> | undefined,
  apiError: { ticker: string | undefined; context: string | undefined },
): DiscoveryQuote {
  const lots = info.longOpenInterestLNS;
  const interval = intervals?.get(instrument.perplMarketId);
  const volume: Metric<bigint> =
    row?.dva !== undefined ? has(row.dva) : lacks(apiError.ticker ?? "Perpl's ticker has no volume for this market");
  return {
    instrument,
    price18: to18(info.markPNS, info),
    priceKind: "mark",
    priceDecimals: info.priceDecimals,
    updatedAt: info.markTimestamp,
    activity: info.paused ? { state: "quiet", reason: "Perpl has paused this market" } : { state: "live" },
    change24h: change24h(row, info, apiError.ticker),
    openInterest: has({
      size: lots,
      sizeDecimals: info.lotDecimals,
      usd6: (lots * info.oraclePNS * oneUnit(DECIMALS.usd6)) / oneUnit(info.lotDecimals + info.priceDecimals),
    }),
    // AUSD (Perpl's collateral) base units are usd6.
    volume24hUsd6: volume,
    funding: has({
      ratePct100k: info.fundingRatePct100k,
      intervalSec:
        interval !== undefined
          ? has(interval)
          : lacks(apiError.context ?? "Perpl's context lists no funding interval for this market"),
    }),
  };
}

const reasonOf = (r: PromiseSettledResult<unknown>): string | undefined =>
  r.status === "rejected"
    ? `Perpl's market-data API didn't answer (${r.reason instanceof Error ? r.reason.message : "network"})`
    : undefined;

/** Quotes for Perpl markets: one Exchange multicall at one block, plus Perpl's ticker and context (best effort). */
export async function fetchPerplQuotes(
  read: ReadClient,
  instruments: readonly PerplInstrument[],
  signal?: AbortSignal,
): Promise<DiscoveryQuoteResult[]> {
  const [infos, ticker, context] = await Promise.all([
    readPerplMarkets(
      read,
      instruments.map((i) => i.perplMarketId),
    ),
    settle(fetchTicker(signal)),
    settle(fundingIntervals(signal)),
  ]);
  const rows = ticker.status === "fulfilled" ? ticker.value : undefined;
  const intervals = context.status === "fulfilled" ? context.value : undefined;
  const apiError = { ticker: reasonOf(ticker), context: reasonOf(context) };
  return instruments.map((instrument, i) => {
    const info = infos[i];
    if (!info || info.markPNS === 0n)
      return {
        id: instrument.id,
        error: { kind: "perpl-down", technical: `${PERPL_PRICE_SOURCE.method}(${instrument.perplMarketId}) failed` },
      };
    return {
      id: instrument.id,
      quote: quoteOf(instrument, info, rows?.get(instrument.perplMarketId), intervals, apiError),
    };
  });
}

/** Oldest → newest trade candles of a Perpl market over the chart window of `interval` (USD × 1e18). */
export async function fetchPerplCandles(
  read: ReadClient,
  instrument: PerplInstrument,
  interval: CandleInterval,
  signal?: AbortSignal,
): Promise<DiscoveryCandles> {
  const toMs = Date.now();
  const windowSec = Math.min(CANDLE_WINDOW_SEC[interval], interval * PERPL_MAX_CANDLES);
  const fromMs = toMs - windowSec * MS_PER_SECOND;
  const [[info], body] = await Promise.all([
    readPerplMarkets(read, [instrument.perplMarketId]),
    getJson(`/v1/market-data/${instrument.perplMarketId}/candles/${interval}/${fromMs}-${toMs}`, signal) as Promise<{
      d?: Array<Record<string, unknown>>;
    }>,
  ]);
  if (!info) throw new Error(`${PERPL_PRICE_SOURCE.method}(${instrument.perplMarketId}) failed`);
  const candles = (body.d ?? [])
    .map((c): TokenCandle | undefined => {
      const [t, o, h, l, close] = [c.t, c.o, c.h, c.l, c.c].map(integer);
      if (t === undefined || o === undefined || h === undefined || l === undefined || close === undefined)
        return undefined;
      return {
        t: Math.floor(Number(t) / MS_PER_SECOND),
        o: to18(o, info),
        h: to18(h, info),
        l: to18(l, info),
        c: to18(close, info),
      };
    })
    .filter((c): c is TokenCandle => c !== undefined)
    .sort((a, b) => a.t - b.t);
  const first = candles[0];
  if (!first) return { kind: "none", reason: "No trades on Perpl in this market over the period" };
  return {
    kind: "history",
    candles,
    source: { text: `Perpl · ${instrument.symbol} trades`, url: PERPL_APP_URL },
    coverage: { from: first.t, complete: true, note: undefined },
  };
}
