/**
 * The terminal's per-tick pass, one copy for both apps (D-272): price the mode's two offered bands (Up and Down, Range,
 * or Moonshot and Crash — S7.4) for the current stake with the contracts' own maths (`@senryo/core/market`, bit for bit
 * with `quoteOpen`), value the open call's cash-out, measure the distance to K, and describe what the chart overlays:
 * the offered band's edges before a call, the held band's winning zone after. Pure: each app writes the result where
 * its screen reads it — shared values on the phone, refs and the canvas on the web — without rendering React per tick.
 */
import type { WindowLoad } from "@senryo/api-client";
import { FILL_DELAY_SEC } from "@senryo/config";
import {
  type BandShape,
  bandEdgesE8,
  bandOutcome,
  type CloseQuote,
  fitOpen,
  formatUnits,
  loadSurchargeE6,
  multiplierE2,
  type OpenQuote,
  P_ONE,
  type QuoteTerms,
  quoteClose,
  quoteOpen,
  reserveCapacity,
} from "@senryo/core";
import type { ReactionPosition } from "./reactions.ts";

const E8 = 1e8;
const PRICE_DECIMALS = 8;
const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const PERCENT = 100n;
/** The distance to the line in thousandths of a percent: a 1-minute move is often under 0.01 %. */
const PERCENT_E3 = 100_000n;
const PERCENT_DECIMALS = 3;
/** Basis points: the reaction engine reads a call's result as a share of its stake. */
const BPS = 10_000n;

/** K, the call's entry, and a band's edge or strike. */
export type LevelKind = "line" | "entry" | "edge";

export interface ChartLevel {
  kind: LevelKind;
  price: number;
  label: string;
}

/** What the chart overlays for the window and the open call (set per tick; read every frame). */
export interface ChartOverlay {
  /** Winning keeps the up tone; losing turns everything the down tone. Null when no call is open. */
  winning: boolean | null;
  /** The pill's second row ("+$1.24"), when a call is open. */
  pnlText: string | null;
  /** Which way the result just moved (the pill's second row rolls up or down). */
  pnlTrend: number;
  /** K. */
  line: number | null;
  /** The held band's winning prices (null ends run off the chart): above K for Up, between the edges for Range… */
  zone: { from: number | null; to: number | null } | null;
  levels: ChartLevel[];
}

/** The catalogue's pool terms (`/v1/markets/catalog` `terms`). */
export interface PoolTerms {
  halfSpreadE6: number;
  minProbE6: number;
  maxProbE6: number;
  maxSurchargeE6: number;
  maxExpiryReserved: bigint;
  maxExposureBps: number;
}

export interface BandSpecLike {
  kind: BandShape["kind"];
  lowBps: number;
  highBps: number;
}

/** The caller's call in this window (`/v1/markets/tickets` row). */
export interface QuotePosition {
  ticketId: bigint;
  band: number;
  state: string;
  stake: bigint;
  payout: bigint;
  entryE8: bigint | null;
}

export interface Pricing {
  terms: QuoteTerms;
  capacity: ReturnType<typeof reserveCapacity> | undefined;
}

/** The terms a quote uses under the window's load (`/v1/markets/load`): the surcharge, and the room left to fill. */
export function pricingFor(terms: PoolTerms, load: WindowLoad | undefined): Pricing {
  return {
    terms: {
      halfSpreadE6: BigInt(terms.halfSpreadE6),
      minProbE6: BigInt(terms.minProbE6),
      maxProbE6: BigInt(terms.maxProbE6),
      surchargeE6: load
        ? loadSurchargeE6(BigInt(terms.maxSurchargeE6), load.reservedByExpiry, terms.maxExpiryReserved)
        : 0n,
    },
    capacity: load
      ? reserveCapacity(load, {
          maxExpiryReserved: terms.maxExpiryReserved,
          maxExposureBps: BigInt(terms.maxExposureBps),
        })
      : undefined,
  };
}

export interface QuoteInput {
  priceE8: number;
  nowSec: number;
  k: bigint;
  expiry: number;
  sigmaE8: number;
  pricing: Pricing;
  stake: bigint;
  /** The mode's two buttons' bands (`offerOf`); the second is absent for Range. */
  offer: readonly [BandSpecLike | undefined, BandSpecLike | undefined];
  /** The open call and its band's shape, when there is one. */
  position: { call: QuotePosition; band: BandSpecLike } | undefined;
}

/** The latest quotes, readable synchronously for the tap (the limit is the quote the user saw). */
export interface Quotes {
  first: OpenQuote | null;
  second: OpenQuote | null;
  close: CloseQuote | null;
}

/** One tick as the reaction engine reads it: the price and, holding a call, its result as a share of the stake. */
export interface QuoteTick {
  t: number;
  price: number;
  position: ReactionPosition | null;
}

export interface QuotePass {
  first: OpenQuote | null;
  second: OpenQuote | null;
  close: CloseQuote | null;
  firstLine: string;
  secondLine: string;
  /** "▲ $12.40 (0.015%) above the line". */
  lineText: string;
  /** What cashing out returns now, and the result against the stake. */
  proceeds: bigint | null;
  pnl: bigint | null;
  overlay: ChartOverlay;
  /** The open call as the reaction engine reads it. */
  reading: ReactionPosition | null;
}

export const dollars = (v: bigint) => `$${formatUnits(v < 0n ? -v : v, DOLLAR_DECIMALS, CENTS)}`;
export const signedDollars = (v: bigint) => `${v < 0n ? "−" : "+"}${dollars(v)}`;

/** "pays 1.92× · about 51%", or why there is no price. */
export function oddsLine(q: OpenQuote | null, stake: bigint): string {
  if (q?.refusal === "capacity") return "Window full · next one soon";
  if (!q || q.refusal) return "Not priced now";
  const x = multiplierE2(stake, q.payout);
  const pct = (q.probE6 * PERCENT) / P_ONE;
  return `pays ${formatUnits(x, CENTS, CENTS)}× · about ${pct}%`;
}

const toPrice = (e8: bigint) => Number(e8) / E8;
const lineLevel = (k: bigint): ChartLevel => ({ kind: "line", price: toPrice(k), label: "Line" });

/** A band's edges or strike as chart levels (Up and Down have none beyond K). */
function edgeLevels(band: BandSpecLike, k: bigint): ChartLevel[] {
  if (band.kind === "up" || band.kind === "down") return [];
  const e = bandEdgesE8(band, k);
  const label = band.kind === "range" ? "Range" : "Strike";
  return [e.low, e.high]
    .filter((v): v is bigint => v !== null)
    .map((v) => ({ kind: "edge", price: toPrice(v), label }));
}

/**
 * How the reaction engine reads a held band: the side that pays and the level that loses it — K for Up and Down, the
 * strike for Moonshot and Crash, and for Range the nearer edge, facing the range's middle.
 */
function bandReading(band: BandSpecLike, k: bigint, spot: bigint): { side: 1 | -1; line: number } {
  const e = bandEdgesE8(band, k);
  if (band.kind === "range" && e.low !== null && e.high !== null) {
    const below = spot * 2n < e.low + e.high;
    return { side: below ? 1 : -1, line: toPrice(below ? e.low : e.high) };
  }
  if (band.kind === "moonshot" && e.low !== null) return { side: 1, line: toPrice(e.low) };
  if (band.kind === "crash" && e.high !== null) return { side: -1, line: toPrice(e.high) };
  return { side: band.kind === "down" ? -1 : 1, line: toPrice(k) };
}

export function quoteTick(i: QuoteInput): QuotePass {
  const spot = BigInt(Math.round(i.priceE8));
  const tauSec = BigInt(Math.max(0, i.expiry - (i.nowSec + FILL_DELAY_SEC)));
  const w = { openE8: i.k, sigmaE8: BigInt(i.sigmaE8), tauSec };
  const { terms, capacity } = i.pricing;
  const price = (b: BandSpecLike | undefined) =>
    b ? fitOpen(quoteOpen(b, w, spot, i.stake, terms), i.stake, capacity) : null;
  const [a, b] = i.offer;
  const first = price(a);
  const second = price(b);

  const diff = spot - i.k;
  const pct = i.k > 0n ? (diff * PERCENT_E3) / i.k : 0n;
  const lineText = `${diff >= 0n ? "▲" : "▼"} $${formatUnits(diff < 0n ? -diff : diff, PRICE_DECIMALS, CENTS)} (${formatUnits(pct < 0n ? -pct : pct, PERCENT_DECIMALS, PERCENT_DECIMALS)}%) ${diff >= 0n ? "above" : "below"} the line`;
  const base = { first, second, firstLine: oddsLine(first, i.stake), secondLine: oddsLine(second, i.stake), lineText };

  const p = i.position;
  if (!p || p.call.state === "committed") {
    const preview = [a, b].flatMap((band) => (band && i.k > 0n ? edgeLevels(band, i.k) : []));
    return {
      ...base,
      close: null,
      proceeds: null,
      pnl: null,
      reading: null,
      overlay: {
        winning: null,
        pnlText: null,
        pnlTrend: 0,
        line: toPrice(i.k),
        zone: null,
        levels: [lineLevel(i.k), ...preview],
      },
    };
  }
  const close = quoteClose(p.band, w, spot, p.call.payout, terms);
  const pnl = close.proceeds - p.call.stake;
  const roiBps = p.call.stake > 0n ? (pnl * BPS) / p.call.stake : 0n;
  const edges = bandEdgesE8(p.band, i.k);
  const reading = bandReading(p.band, i.k, spot);
  return {
    ...base,
    close,
    proceeds: close.proceeds,
    pnl,
    reading: {
      key: String(p.call.ticketId),
      side: reading.side,
      pnl: Number(roiBps),
      margin: Number(BPS),
      entry: p.call.entryE8 === null ? i.priceE8 / E8 : toPrice(p.call.entryE8),
      line: reading.line,
    },
    overlay: {
      winning: bandOutcome(p.band, i.k, spot) === "win",
      pnlText: signedDollars(pnl),
      pnlTrend: 0,
      line: toPrice(i.k),
      zone: {
        from: edges.low === null ? null : toPrice(edges.low),
        to: edges.high === null ? null : toPrice(edges.high),
      },
      levels: [
        lineLevel(i.k),
        ...edgeLevels(p.band, i.k),
        ...(p.call.entryE8 !== null
          ? [{ kind: "entry" as const, price: toPrice(p.call.entryE8), label: "Entry" }]
          : []),
      ],
    },
  };
}

/** Which way a money figure moved, compared as bigints (−1, 0, 1). */
export const trendOf = (was: bigint | null, now: bigint): number =>
  was === null || was === now ? 0 : now > was ? 1 : -1;
