/**
 * Read-only discovery types (review S03): a quote, its metrics and a chart's candles. A field a source doesn't have is
 * a `Metric` with the reason, never a number.
 */
import type { DiscoveryId, DiscoveryInstrument } from "@senryo/config";
import type { Diagnosis } from "@senryo/core";
import type { TokenCandle } from "./spot-candles.ts";

/** A value the source has, or the reason it has none. */
export type Metric<T> = { available: true; value: T } | { available: false; reason: string };

export const has = <T>(value: T): Metric<T> => ({ available: true, value });
export const lacks = (reason: string): Metric<never> => ({ available: false, reason });

export interface DiscoveryChange {
  /** USD × 1e18 the change is measured from, and when it was current (unix s; undefined when the source only says "24 h ago"). */
  fromPrice18: bigint;
  fromAt: number | undefined;
  /** Signed basis points of `fromPrice18`. */
  bps: bigint;
  /** What is compared with what, in words. */
  basis: string;
}

export interface DiscoveryOpenInterest {
  /** One side's open interest in base units (`sizeDecimals`). */
  size: bigint;
  sizeDecimals: number;
  /** Its value (usd6) at the oracle price, as Perpl shows it. */
  usd6: bigint;
}

export interface DiscoveryFunding {
  /** The last applied funding rate per interval, in 1e-5 (100 = 0.1 %); positive: longs pay. */
  ratePct100k: number;
  intervalSec: Metric<number>;
}

export interface DiscoveryQuote {
  instrument: DiscoveryInstrument;
  /** USD × 1e18 per unit: Perpl's mark price, or the feed's latest calculated wrapper price. */
  price18: bigint;
  priceKind: "mark" | "calculated";
  /** The decimals the venue prices in (Perpl's tick, the feed's cents) — for display. */
  priceDecimals: number;
  /** Unix seconds the price is current as of (Perpl's mark timestamp, the round's updatedAt). */
  updatedAt: number;
  /** "quiet": a calculated feed past heartbeat + grace (session closed or stalled), or a paused Perpl market. */
  activity: { state: "live" } | { state: "quiet"; reason: string };
  change24h: Metric<DiscoveryChange>;
  openInterest: Metric<DiscoveryOpenInterest>;
  /** 24 h volume (usd6). */
  volume24hUsd6: Metric<bigint>;
  funding: Metric<DiscoveryFunding>;
}

/** One instrument's quote from a group read, or why that one failed while the rest read. */
export type DiscoveryQuoteResult = { id: DiscoveryId; quote: DiscoveryQuote } | { id: DiscoveryId; error: Diagnosis };

export interface DiscoveryCoverage {
  /** Unix seconds of the oldest price in the chart. */
  from: number;
  /** False when older prices exist that this read didn't reach (`note` says where they come from). */
  complete: boolean;
  note: string | undefined;
}

/** Same shape as `TokenCandles` (the spot chart takes either), plus how far back the history reaches. */
export type DiscoveryCandles =
  | {
      kind: "history";
      candles: TokenCandle[];
      source: { text: string; url: string };
      coverage: DiscoveryCoverage;
    }
  | { kind: "none"; reason: string };
