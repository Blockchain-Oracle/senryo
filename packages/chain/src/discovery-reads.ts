/**
 * Read-only discovery reads on Monad mainnet (review S03): Perpl's market state straight from its Exchange
 * (`PERPL_PRICE_SOURCE`), and the Chainlink calculated tokenized-equity feeds — latest round, the round in effect at a
 * time (searched by `updatedAt`, never scanned) and contiguous round ranges for charts. Pass a mainnet read client.
 *
 * A proxy round id is `phase << 64 | aggregatorRound`, and aggregator rounds run 1…latest without gaps (OCR2), so a
 * range or a search is plain arithmetic on ids inside the current phase. Earlier phases are not crossed.
 */
import { type ChainId, MAINNET_CHAIN_ID, PERPL_EXCHANGE, PERPL_PRICE_SOURCE } from "@senryo/config";
import { aggregatorV3InterfaceAbi } from "@senryo/contracts/abis";
import type { Address } from "viem";
import type { ReadClient } from "./clients.ts";

/** `getPerpetualInfo(uint256)` — every component in order (the tuple decodes positionally). */
const perplExchangeAbi = [
  {
    type: "function",
    name: "getPerpetualInfo",
    stateMutability: "view",
    inputs: [{ name: "perpId", type: "uint256" }],
    outputs: [
      {
        name: "perpetualInfo",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "priceDecimals", type: "uint256" },
          { name: "lotDecimals", type: "uint256" },
          { name: "linkFeedId", type: "bytes32" },
          { name: "priceTolPer100K", type: "uint256" },
          { name: "marginTol", type: "uint256" },
          { name: "marginTolDecimals", type: "uint256" },
          { name: "refPriceMaxAgeSec", type: "uint256" },
          { name: "positionBalanceCNS", type: "uint256" },
          { name: "insuranceBalanceCNS", type: "uint256" },
          { name: "markPNS", type: "uint256" },
          { name: "markTimestamp", type: "uint256" },
          { name: "lastPNS", type: "uint256" },
          { name: "lastTimestamp", type: "uint256" },
          { name: "oraclePNS", type: "uint256" },
          { name: "oracleTimestampSec", type: "uint256" },
          { name: "longOpenInterestLNS", type: "uint256" },
          { name: "shortOpenInterestLNS", type: "uint256" },
          { name: "fundingStartBlock", type: "uint256" },
          { name: "fundingRatePct100k", type: "int16" },
          { name: "absFundingClampPctPer100K", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "basePricePNS", type: "uint256" },
          { name: "maxBidPriceONS", type: "uint256" },
          { name: "minBidPriceONS", type: "uint256" },
          { name: "maxAskPriceONS", type: "uint256" },
          { name: "minAskPriceONS", type: "uint256" },
          { name: "numOrders", type: "uint256" },
          { name: "ignOracle", type: "bool" },
        ],
      },
    ],
  },
] as const;

/** Rounds per `eth_call` (≈ 1.9 s on rpc.monad.xyz, inside HTTP_TIMEOUT_MS; 2,000 also passed at ≈ 2.8 s). */
export const ROUNDS_PER_CALL = 1_000;
/** Round calls in flight at once against the public RPC. */
const ROUND_CALLS_IN_FLIGHT = 3;
/** Probes per feed per search step: 5,000 rounds resolve in three steps. */
const SEARCH_PROBES = 64;
const PHASE_SHIFT = 64n;
const AGGREGATOR_ROUND_MASK = (1n << PHASE_SHIFT) - 1n;
const FIRST_ROUND = 1n;

/** A uint read that is a small count, a decimal place or a timestamp (never money). */
const int = (value: bigint | number): number => Number(value);

export interface PerplMarketInfo {
  marketId: number;
  priceDecimals: number;
  lotDecimals: number;
  /** Prices in Perpl's scaled units (÷ 10^priceDecimals = USD); timestamps unix seconds. */
  markPNS: bigint;
  markTimestamp: number;
  lastPNS: bigint;
  lastTimestamp: number;
  oraclePNS: bigint;
  oracleTimestamp: number;
  /** Open interest per side in lots (÷ 10^lotDecimals = units); a perp's long and short sides are equal. */
  longOpenInterestLNS: bigint;
  shortOpenInterestLNS: bigint;
  /** The last applied funding rate per funding interval, in 1e-5 (`PERPL_PRICE_SOURCE.fundingRateDecimals`). */
  fundingRatePct100k: number;
  paused: boolean;
}

/** Each market's state from the Exchange in one multicall; a market whose read failed is `undefined`. */
export async function readPerplMarkets(
  read: ReadClient,
  marketIds: readonly number[],
  chainId: ChainId = MAINNET_CHAIN_ID,
): Promise<Array<PerplMarketInfo | undefined>> {
  const results = await read.multicall({
    contracts: marketIds.map((id) => ({
      address: PERPL_EXCHANGE[chainId],
      abi: perplExchangeAbi,
      functionName: "getPerpetualInfo",
      args: [BigInt(id)],
    })),
    allowFailure: true,
  });
  return results.map((r, i) => {
    const marketId = marketIds[i];
    if (r.status !== "success" || marketId === undefined) return undefined;
    const p = r.result;
    return {
      marketId,
      priceDecimals: int(p.priceDecimals),
      lotDecimals: int(p.lotDecimals),
      markPNS: p.markPNS,
      markTimestamp: int(p.markTimestamp),
      lastPNS: p.lastPNS,
      lastTimestamp: int(p.lastTimestamp),
      oraclePNS: p.oraclePNS,
      oracleTimestamp: int(p.oracleTimestampSec),
      longOpenInterestLNS: p.longOpenInterestLNS,
      shortOpenInterestLNS: p.shortOpenInterestLNS,
      fundingRatePct100k: p.fundingRatePct100k,
      paused: p.status === PERPL_PRICE_SOURCE.pausedStatus,
    };
  });
}

// ---------------------------------------------------------------- Chainlink rounds

export interface FeedRoundPoint {
  /** The proxy's round id (phase-encoded). */
  roundId: bigint;
  /** The raw answer in the feed's decimals. */
  answer: bigint;
  updatedAt: number;
}

export interface FeedLatest {
  description: string;
  decimals: number;
  latest: FeedRoundPoint;
}

export const phaseOf = (roundId: bigint): bigint => roundId >> PHASE_SHIFT;
export const aggregatorRoundOf = (roundId: bigint): bigint => roundId & AGGREGATOR_ROUND_MASK;
const proxyRoundId = (phase: bigint, aggregatorRound: bigint): bigint => (phase << PHASE_SHIFT) | aggregatorRound;

/** `description()`, `decimals()` and `latestRoundData()` of each proxy in one multicall; a failed feed is undefined. */
export async function readFeedsLatest(
  read: ReadClient,
  proxies: readonly Address[],
): Promise<Array<FeedLatest | undefined>> {
  const results = await read.multicall({
    contracts: proxies.flatMap((address) => [
      { address, abi: aggregatorV3InterfaceAbi, functionName: "description" } as const,
      { address, abi: aggregatorV3InterfaceAbi, functionName: "decimals" } as const,
      { address, abi: aggregatorV3InterfaceAbi, functionName: "latestRoundData" } as const,
    ]),
    allowFailure: true,
  });
  const PER_FEED = 3;
  return proxies.map((_, i) => {
    const [description, decimals, latest] = results.slice(i * PER_FEED, (i + 1) * PER_FEED);
    if (description?.status !== "success" || decimals?.status !== "success" || latest?.status !== "success")
      return undefined;
    const [roundId, answer, , updatedAt] = latest.result as readonly [bigint, bigint, bigint, bigint, bigint];
    return {
      description: description.result as string,
      decimals: decimals.result as number,
      latest: { roundId, answer, updatedAt: int(updatedAt) },
    };
  });
}

interface RoundRequest {
  proxy: Address;
  roundId: bigint;
}

/** `getRoundData` for each request, in order — ROUNDS_PER_CALL per call, a few calls in flight. Any revert throws. */
async function readRounds(read: ReadClient, requests: readonly RoundRequest[]): Promise<FeedRoundPoint[]> {
  const chunks: RoundRequest[][] = [];
  for (let i = 0; i < requests.length; i += ROUNDS_PER_CALL) chunks.push(requests.slice(i, i + ROUNDS_PER_CALL));
  const out: FeedRoundPoint[][] = new Array(chunks.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < chunks.length) {
      const index = next;
      next += 1;
      const chunk = chunks[index] ?? [];
      const results = await read.multicall({
        contracts: chunk.map((r) => ({
          address: r.proxy,
          abi: aggregatorV3InterfaceAbi,
          functionName: "getRoundData",
          args: [r.roundId],
        })),
        allowFailure: false,
        batchSize: 0,
      });
      out[index] = results.map((row) => {
        const [roundId, answer, , updatedAt] = row as readonly [bigint, bigint, bigint, bigint, bigint];
        return { roundId, answer, updatedAt: int(updatedAt) };
      });
    }
  }
  await Promise.all(Array.from({ length: Math.min(ROUND_CALLS_IN_FLIGHT, chunks.length) }, worker));
  return out.flat();
}

/**
 * Rounds `fromRound`…`toRound` (aggregator round numbers, inclusive) of the phase `latestRoundId` belongs to, oldest
 * first. Clamped to 1…latest.
 */
export async function readFeedRoundRange(
  read: ReadClient,
  proxy: Address,
  latestRoundId: bigint,
  fromRound: bigint,
  toRound: bigint,
): Promise<FeedRoundPoint[]> {
  const phase = phaseOf(latestRoundId);
  const lo = fromRound < FIRST_ROUND ? FIRST_ROUND : fromRound;
  const latest = aggregatorRoundOf(latestRoundId);
  const hi = toRound > latest ? latest : toRound;
  const requests: RoundRequest[] = [];
  for (let r = lo; r <= hi; r += 1n) requests.push({ proxy, roundId: proxyRoundId(phase, r) });
  return readRounds(read, requests);
}

export interface RoundSearch {
  proxy: Address;
  latestRoundId: bigint;
  /** Unix seconds: find the newest round with `updatedAt` ≤ this. */
  at: number;
  /** A round already known to be ≤ `at` (an earlier answer for an earlier `at`): the search starts there. */
  floorRoundId?: bigint | undefined;
}

interface Span {
  phase: bigint;
  lo: bigint;
  hi: bigint;
  done: boolean;
  result: FeedRoundPoint | undefined;
}

function probesOf(lo: bigint, hi: bigint): bigint[] {
  const width = hi - lo;
  if (width + 1n <= BigInt(SEARCH_PROBES)) {
    const all: bigint[] = [];
    for (let r = lo; r <= hi; r += 1n) all.push(r);
    return all;
  }
  const steps = BigInt(SEARCH_PROBES - 1);
  const ids = Array.from({ length: SEARCH_PROBES }, (_, i) => lo + (width * BigInt(i)) / steps);
  return [...new Set(ids)];
}

/**
 * For each search, the newest round of the current phase with `updatedAt` ≤ `at` — or undefined when the phase's first
 * round is already later. Every feed narrows together: one multicall of ≤ 64 probes per feed per step.
 */
export async function findRoundsAtOrBefore(
  read: ReadClient,
  searches: readonly RoundSearch[],
): Promise<Array<FeedRoundPoint | undefined>> {
  const spans: Span[] = searches.map((s) => {
    const phase = phaseOf(s.latestRoundId);
    const floor = s.floorRoundId !== undefined && phaseOf(s.floorRoundId) === phase ? s.floorRoundId : undefined;
    return {
      phase,
      lo: floor === undefined ? FIRST_ROUND : aggregatorRoundOf(floor),
      hi: aggregatorRoundOf(s.latestRoundId),
      done: false,
      result: undefined,
    };
  });
  while (spans.some((s) => !s.done)) {
    const plan = spans.map((span) => (span.done ? [] : probesOf(span.lo, span.hi)));
    const rounds = await readRounds(
      read,
      plan.flatMap((probes, i) =>
        probes.map((r) => ({ proxy: searches[i]?.proxy as Address, roundId: proxyRoundId(spans[i]?.phase ?? 0n, r) })),
      ),
    );
    let cursor = 0;
    for (const [i, probes] of plan.entries()) {
      const span = spans[i];
      const at = searches[i]?.at ?? 0;
      if (!span || probes.length === 0) continue;
      const got = rounds.slice(cursor, cursor + probes.length);
      cursor += probes.length;
      let j = -1;
      for (const [k, round] of got.entries()) if (round.updatedAt <= at) j = k;
      const exhaustive = probes.length === int(span.hi - span.lo + 1n);
      const hit = got[j];
      const after = probes[j + 1];
      if (j < 0 || !hit) span.done = true;
      else if (exhaustive || after === undefined) Object.assign(span, { done: true, result: hit });
      else Object.assign(span, { lo: probes[j] ?? span.lo, hi: after - 1n });
    }
  }
  return spans.map((s) => s.result);
}
