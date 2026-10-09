/**
 * The terminal's per-tick pass, one copy for both apps (D-272): price Up and Down for the current stake with the
 * contracts' own maths (`@senryo/core/market`, bit for bit with `quoteOpen`), value the open call's cash-out, measure
 * the distance to K, and describe what the chart overlays. Pure: each app writes the result where its screen reads
 * it — shared values on the phone, refs and the canvas on the web — without rendering React per tick.
 */
import type { WindowLoad } from "@senryo/api-client";
import { FILL_DELAY_SEC } from "@senryo/config";
import {
  type BandShape,
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

export type LevelKind = "line" | "entry";

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
  /** K and the call's side: the zone above K (Up) or below it (Down) is shaded. */
  line: number | null;
  zone: "above" | "below" | null;
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
  up: BandSpecLike | undefined;
  down: BandSpecLike | undefined;
  /** The open call and its band's shape, when there is one. */
  position: { call: QuotePosition; band: BandSpecLike } | undefined;
}

/** The latest quotes, readable synchronously for the tap (the limit is the quote the user saw). */
export interface Quotes {
  up: OpenQuote | null;
  down: OpenQuote | null;
  close: CloseQuote | null;
}

/** One tick as the reaction engine reads it: the price and, holding a call, its result as a share of the stake. */
export interface QuoteTick {
  t: number;
  price: number;
  position: ReactionPosition | null;
}

export interface QuotePass {
  up: OpenQuote | null;
  down: OpenQuote | null;
  close: CloseQuote | null;
  upLine: string;
  downLine: string;
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

const lineLevel = (k: bigint): ChartLevel => ({ kind: "line", price: Number(k) / E8, label: "Line" });

export function quoteTick(i: QuoteInput): QuotePass {
  const spot = BigInt(Math.round(i.priceE8));
  const tauSec = BigInt(Math.max(0, i.expiry - (i.nowSec + FILL_DELAY_SEC)));
  const w = { openE8: i.k, sigmaE8: BigInt(i.sigmaE8), tauSec };
  const { terms, capacity } = i.pricing;
  const up = i.up ? fitOpen(quoteOpen(i.up, w, spot, i.stake, terms), i.stake, capacity) : null;
  const down = i.down ? fitOpen(quoteOpen(i.down, w, spot, i.stake, terms), i.stake, capacity) : null;

  const diff = spot - i.k;
  const pct = i.k > 0n ? (diff * PERCENT_E3) / i.k : 0n;
  const lineText = `${diff >= 0n ? "▲" : "▼"} $${formatUnits(diff < 0n ? -diff : diff, PRICE_DECIMALS, CENTS)} (${formatUnits(pct < 0n ? -pct : pct, PERCENT_DECIMALS, PERCENT_DECIMALS)}%) ${diff >= 0n ? "above" : "below"} the line`;
  const base = { up, down, upLine: oddsLine(up, i.stake), downLine: oddsLine(down, i.stake), lineText };

  const p = i.position;
  if (!p || p.call.state === "committed") {
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
        line: Number(i.k) / E8,
        zone: null,
        levels: [lineLevel(i.k)],
      },
    };
  }
  const close = quoteClose(p.band, w, spot, p.call.payout, terms);
  const pnl = close.proceeds - p.call.stake;
  const roiBps = p.call.stake > 0n ? (pnl * BPS) / p.call.stake : 0n;
  const isDown = p.band.kind === "down";
  return {
    ...base,
    close,
    proceeds: close.proceeds,
    pnl,
    reading: {
      key: String(p.call.ticketId),
      side: isDown ? -1 : 1,
      pnl: Number(roiBps),
      margin: Number(BPS),
      entry: p.call.entryE8 === null ? i.priceE8 / E8 : Number(p.call.entryE8) / E8,
      line: Number(i.k) / E8,
    },
    overlay: {
      winning: isDown ? spot < i.k : spot > i.k,
      pnlText: signedDollars(pnl),
      pnlTrend: 0,
      line: Number(i.k) / E8,
      zone: isDown ? "below" : "above",
      levels: [
        lineLevel(i.k),
        ...(p.call.entryE8 !== null
          ? [{ kind: "entry" as const, price: Number(p.call.entryE8) / E8, label: "Entry" }]
          : []),
      ],
    },
  };
}

/** Which way a money figure moved, compared as bigints (−1, 0, 1). */
export const trendOf = (was: bigint | null, now: bigint): number =>
  was === null || was === now ? 0 : now > was ? 1 : -1;
