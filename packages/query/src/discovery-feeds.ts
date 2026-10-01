/**
 * Chainlink calculated tokenized-equity feeds, read-only (review S03, D-220). Each prices the xStocks wrapper (wSPYx),
 * so a quote is "SPY via wSPYx calculated feed", never a share price. Read through each proxy on mainnet:
 *  - quote: `description()` (asserted), `decimals()`, `latestRoundData()`; 24 h change against the last round ≥ 24 h
 *    before the latest one (so a weekend shows Friday's day, labelled with its time), found by search, not a scan;
 *  - chart: the indexer's candles once it indexes these feeds (indexer/config.yaml `FeedW…X`, not deployed yet), else
 *    OHLC built here from every round in the window, read back from the chain (≤ `FEED_HISTORY_MAX_ROUNDS`).
 * Rounds never change once written, so both reads keep what they found for the session and fetch only what's new.
 */
import {
  aggregatorRoundOf,
  type FeedLatest,
  type FeedRoundPoint,
  findRoundsAtOrBefore,
  phaseOf,
  type ReadClient,
  ROUNDS_PER_CALL,
  readFeedRoundRange,
  readFeedsLatest,
} from "@senryo/chain";
import {
  CALCULATED_FEED_GRACE_SEC,
  type CalculatedEquityInstrument,
  explorerAddressUrl,
  MAINNET_CHAIN_ID,
} from "@senryo/config";
import { BPS_DENOMINATOR, DECIMALS, type Diagnosis, divRound, rescale } from "@senryo/core";
import { type CandleInterval, CandlesDocument, candlesVars, type IndexerClient } from "@senryo/indexer-client";
import { CANDLE_WINDOW_SEC, FEED_HISTORY_MAX_ROUNDS } from "./constants.ts";
import {
  type DiscoveryCandles,
  type DiscoveryCoverage,
  type DiscoveryQuote,
  type DiscoveryQuoteResult,
  has,
  lacks,
} from "./discovery-types.ts";
import type { TokenCandle } from "./spot-candles.ts";

const DAY_SEC = 86_400;
const MS_PER_SECOND = 1000;
/** Read this much more than the measured round rate predicts, so one extra pass is rare. */
const ROUND_ESTIMATE_MARGIN = 1.25;
/** Passes back in time per chart read (each is ≤ ROUNDS_PER_CALL × the reads in flight). */
const MAX_BACKFILL_PASSES = 3;
/** Rounds kept per feed for the session: the read budget plus a day of new rounds on the busiest feed. */
const MAX_CACHED_ROUNDS = FEED_HISTORY_MAX_ROUNDS * 2;
const NO_MARKET = "A calculated price feed has no market of its own";

const nowSec = (): number => Math.floor(Date.now() / MS_PER_SECOND);

/** The last round found ≥ 24 h before each feed's latest: the next search starts there. */
const dayAgo = new Map<string, FeedRoundPoint>();
/** Contiguous rounds of each feed's current phase, oldest first. */
const history = new Map<string, { phase: bigint; rounds: FeedRoundPoint[] }>();

/** The read, if it is the feed the instrument names with a usable answer; else why not. */
function checked(instrument: CalculatedEquityInstrument, read: FeedLatest | undefined): FeedLatest | Diagnosis {
  const { feed } = instrument;
  if (!read) return { kind: "rpc-down", technical: `${feed.description}: latestRoundData failed` };
  if (read.description !== feed.description || read.decimals !== feed.decimals)
    return {
      kind: "unknown",
      technical: `${feed.proxy} answers "${read.description}" (${read.decimals} dec), expected "${feed.description}"`,
    };
  if (read.latest.answer <= 0n) return { kind: "oracle-stale", technical: `${feed.description}: no positive answer` };
  return read;
}

const isRead = (r: FeedLatest | Diagnosis | undefined): r is FeedLatest => r !== undefined && "latest" in r;

function quoteOf(
  instrument: CalculatedEquityInstrument,
  read: FeedLatest,
  from: FeedRoundPoint | undefined,
): DiscoveryQuote {
  const { feed } = instrument;
  const to18 = (answer: bigint) => rescale(answer, read.decimals, DECIMALS.e18);
  const age = nowSec() - read.latest.updatedAt;
  return {
    instrument,
    price18: to18(read.latest.answer),
    priceKind: "calculated",
    priceDecimals: DECIMALS.cents,
    updatedAt: read.latest.updatedAt,
    activity:
      age > feed.heartbeatSec + CALCULATED_FEED_GRACE_SEC
        ? { state: "quiet", reason: "No round within its heartbeat: the 24/5 session is closed, or the feed stalled" }
        : { state: "live" },
    change24h:
      from && from.answer > 0n
        ? has({
            fromPrice18: to18(from.answer),
            fromAt: from.updatedAt,
            bps: divRound((read.latest.answer - from.answer) * BPS_DENOMINATOR, from.answer),
            basis: "Latest round vs 24 h earlier",
          })
        : lacks("The feed's current aggregator is younger than 24 h"),
    openInterest: lacks(`${NO_MARKET}: no open interest`),
    volume24hUsd6: lacks(`${NO_MARKET}: no volume`),
    funding: lacks("Not a perpetual: no funding"),
  };
}

/** Quotes for the calculated feeds: one multicall for every latest round, then the 24 h search across all of them. */
export async function fetchFeedQuotes(
  read: ReadClient,
  instruments: readonly CalculatedEquityInstrument[],
): Promise<DiscoveryQuoteResult[]> {
  const latest = await readFeedsLatest(
    read,
    instruments.map((i) => i.feed.proxy),
  );
  const valid = instruments.map((instrument, i) => checked(instrument, latest[i]));
  const searched = instruments.flatMap((instrument, i) => {
    const ok = valid[i];
    return isRead(ok) ? [{ instrument, read: ok }] : [];
  });
  const found = await findRoundsAtOrBefore(
    read,
    searched.map(({ instrument, read: r }) => ({
      proxy: instrument.feed.proxy,
      latestRoundId: r.latest.roundId,
      at: r.latest.updatedAt - DAY_SEC,
      floorRoundId: dayAgo.get(instrument.feed.proxy)?.roundId,
    })),
  );
  const fromBy = new Map<string, FeedRoundPoint | undefined>();
  for (const [k, { instrument }] of searched.entries()) {
    const round = found[k];
    fromBy.set(instrument.id, round);
    if (round) dayAgo.set(instrument.feed.proxy, round);
  }
  return instruments.map((instrument, i) => {
    const ok = valid[i];
    if (!isRead(ok))
      return { id: instrument.id, error: ok ?? { kind: "unknown", technical: instrument.feed.description } };
    return { id: instrument.id, quote: quoteOf(instrument, ok, fromBy.get(instrument.id)) };
  });
}

// ---------------------------------------------------------------- chart

/** OHLC per interval from rounds (USD × 1e18); an interval without a round has no candle (D-020). */
function bucket(rounds: readonly FeedRoundPoint[], decimals: number, interval: number): TokenCandle[] {
  const byOpen = new Map<number, TokenCandle>();
  for (const round of rounds) {
    if (round.answer <= 0n) continue;
    const p = rescale(round.answer, decimals, DECIMALS.e18);
    const t = Math.floor(round.updatedAt / interval) * interval;
    const c = byOpen.get(t);
    if (!c) byOpen.set(t, { t, o: p, h: p, l: p, c: p });
    else Object.assign(c, { h: p > c.h ? p : c.h, l: p < c.l ? p : c.l, c: p });
  }
  return [...byOpen.values()].sort((a, b) => a.t - b.t);
}

/** Rounds since `since` from the session cache, reading only the newer rounds and, if needed, older ones. */
async function roundsSince(
  read: ReadClient,
  proxy: `0x${string}`,
  latestRoundId: bigint,
  since: number,
): Promise<{ rounds: FeedRoundPoint[]; coverage: DiscoveryCoverage }> {
  const phase = phaseOf(latestRoundId);
  const latest = aggregatorRoundOf(latestRoundId);
  let cached = history.get(proxy);
  if (!cached || cached.phase !== phase) cached = { phase, rounds: [] };
  const newest = cached.rounds.at(-1);
  const newestRound = newest ? aggregatorRoundOf(newest.roundId) : undefined;
  if (newestRound === undefined || latest - newestRound > BigInt(FEED_HISTORY_MAX_ROUNDS)) {
    cached.rounds = await readFeedRoundRange(read, proxy, latestRoundId, latest - BigInt(ROUNDS_PER_CALL) + 1n, latest);
  } else if (newestRound < latest) {
    cached.rounds.push(...(await readFeedRoundRange(read, proxy, latestRoundId, newestRound + 1n, latest)));
  }
  for (let pass = 0; pass < MAX_BACKFILL_PASSES; pass += 1) {
    const first = cached.rounds[0];
    const last = cached.rounds.at(-1);
    if (!first || !last || first.updatedAt <= since || aggregatorRoundOf(first.roundId) <= 1n) break;
    const budget = FEED_HISTORY_MAX_ROUNDS - cached.rounds.filter((r) => r.updatedAt >= since).length;
    if (budget <= 0) break;
    const perSec = cached.rounds.length / Math.max(last.updatedAt - first.updatedAt, 1);
    const wanted = Math.ceil((first.updatedAt - since) * perSec * ROUND_ESTIMATE_MARGIN);
    const count = BigInt(Math.min(Math.max(wanted, ROUNDS_PER_CALL), budget));
    const firstRound = aggregatorRoundOf(first.roundId);
    const older = await readFeedRoundRange(read, proxy, latestRoundId, firstRound - count, firstRound - 1n);
    cached.rounds = [...older, ...cached.rounds];
  }
  if (cached.rounds.length > MAX_CACHED_ROUNDS) cached.rounds = cached.rounds.slice(-MAX_CACHED_ROUNDS);
  history.set(proxy, cached);
  const first = cached.rounds[0];
  const reachedStart = first !== undefined && aggregatorRoundOf(first.roundId) <= 1n;
  const reachedSince = first !== undefined && first.updatedAt <= since;
  const rounds = cached.rounds.filter((r) => r.updatedAt >= since);
  const coverage: DiscoveryCoverage = {
    from: rounds[0]?.updatedAt ?? since,
    complete: reachedSince || reachedStart,
    note:
      reachedSince || !first
        ? undefined
        : reachedStart
          ? "The feed's first round"
          : "Older rounds arrive when the indexer adds these feeds",
  };
  return { rounds, coverage };
}

/**
 * Oldest → newest candles of a calculated feed over the chart window of `interval`: the indexer's when it has any for
 * the window, else built from onchain rounds. A failed indexer request falls through to the chain.
 */
export async function fetchFeedCandles(
  read: ReadClient,
  instrument: CalculatedEquityInstrument,
  interval: CandleInterval,
  indexer?: Pick<IndexerClient, "request">,
  signal?: AbortSignal,
): Promise<DiscoveryCandles> {
  const { feed } = instrument;
  const since = nowSec() - CANDLE_WINDOW_SEC[interval];
  const url = explorerAddressUrl(MAINNET_CHAIN_ID, feed.proxy);
  if (indexer) {
    const indexed = await indexer
      .request(CandlesDocument, candlesVars(MAINNET_CHAIN_ID, feed.indexerFeed, interval, { since }), signal)
      .catch(() => []);
    const first = indexed[0];
    if (first)
      return {
        kind: "history",
        candles: indexed.map((c) => ({ t: c.openTime, o: c.open, h: c.high, l: c.low, c: c.close })),
        source: { text: `Chainlink ${feed.description} · Monad · indexed rounds`, url },
        coverage: { from: first.openTime, complete: true, note: undefined },
      };
  }
  const [latest] = await readFeedsLatest(read, [feed.proxy]);
  const ok = checked(instrument, latest);
  if (!isRead(ok)) throw new Error(ok.technical);
  const { rounds, coverage } = await roundsSince(read, feed.proxy, ok.latest.roundId, since);
  const candles = bucket(rounds, ok.decimals, interval);
  if (candles.length === 0) return { kind: "none", reason: "No rounds over the period: the 24/5 session was closed" };
  return {
    kind: "history",
    candles,
    source: { text: `Chainlink ${feed.description} · Monad · rounds read onchain`, url },
    coverage,
  };
}
