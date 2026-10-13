/**
 * The terminal's per-tick pass, one copy for both apps (D-272): price the mode's two offered bands (Up and Down, Range,
 * or Moonshot and Crash — S7.4) for the current stake with the contracts' own maths (`@senryo/core/market`, bit for bit
 * with `quoteOpen`), value the open call's cash-out, measure the distance to K, and describe what the chart overlays:
 * the offered band's edges before a call, the held band's winning zone after. Pure: each app writes the result where
 * its screen reads it — shared values on the phone, refs and the canvas on the web — without rendering React per tick.
 */
import type { WindowLoad } from "@senryo/api-client";
import { type CadenceSec, FILL_DELAY_SEC, quoteCurve } from "@senryo/config";
import {
  type BandShape,
  bandEdgesE8,
  bandOutcome,
  type CloseQuote,
  fitOpen,
  formatUnits,
  gapText,
  loadSurchargeE6,
  multiplierE2,
  type OpenQuote,
  P_ONE,
  type PriceUnit,
  type QuoteTerms,
  quoteClose,
  quoteOpen,
  reserveCapacity,
  type SigmaPair,
} from "@senryo/core";
import { type BookCallExit, callBreakEvenE8, callExitLevelsE8, callFigures } from "./book.ts";
import { closeLimit, openLimit } from "./limits.ts";
import type { ReactionPosition } from "./reactions.ts";

const E8 = 1e8;
const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const PERCENT = 100n;
/** The distance to the line in thousandths of a percent: a 1-minute move is often under 0.01 %. */
const PERCENT_E3 = 100_000n;
const PERCENT_DECIMALS = 3;
/** Basis points: the reaction engine reads a call's result as a share of its stake. */
const BPS = 10_000n;

/**
 * K, the entry, a band's edge or strike, and a held position's levels (Tradash's tags, R5.6): break-even, the trail's
 * stop, take-profit and stop-loss, and a ride's knock-out and cap.
 */
export type LevelKind = "line" | "entry" | "edge" | "be" | "trail" | "tp" | "sl" | "ko" | "cap";

export interface ChartLevel {
  kind: LevelKind;
  price: number;
  label: string;
}

/** What the chart overlays for the window and the open call (set per tick; read every frame). */
export interface ChartOverlay {
  /** PnL ≥ 0 keeps the up tone; below 0 turns everything the down tone (D-303). Null when no call is open. */
  winning: boolean | null;
  /** The pill's second row ("+$1.24"), when a call is open. */
  pnlText: string | null;
  /** Which way the result just moved (the pill's second row rolls up or down). */
  pnlTrend: number;
  /** K. */
  line: number | null;
  /** The held band's winning prices (null ends run off the chart): above K for Up, between the edges for Range… */
  zone: { from: number | null; to: number | null } | null;
  /**
   * The zone's own tone when it previews an offered side before any call (F8: hover or focus on a button shades where
   * it wins); null draws a held call's zone in the winning tone.
   */
  zoneTone: "up" | "down" | "range" | null;
  levels: ChartLevel[];
  /** A held position's entry: the price path is closed down to it in a fading band (Tradash's PnL band). */
  band?: number | null;
}

/** The catalogue's pool terms (`/v1/markets/catalog` `terms`). */
export interface PoolTerms {
  /** The spread curve's floor (a series' h50 is its lane's, `H50_E6`). */
  minHalfSpreadE6: number;
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
  /** The fair chance at the fill (D-303), null for a call filled before it was recorded. */
  fillProbE6: number | null;
  /** Its standing exit (bids × 1e6), drawn as levels. */
  exit: BookCallExit | null;
}

/** What a quote reads of the pool's terms (the api's catalogue `terms`, or `POOL_TERMS`). */
export type QuoteTermsSource = Pick<
  PoolTerms,
  "minHalfSpreadE6" | "minProbE6" | "maxProbE6" | "maxSurchargeE6" | "maxExpiryReserved" | "maxExposureBps"
>;

export interface Pricing {
  terms: QuoteTerms;
  capacity: ReturnType<typeof reserveCapacity> | undefined;
}

/** The terms a quote uses under the window's load (`/v1/markets/load`): the series' spread curve (its lane's h50),
 *  the surcharge, and the room left to fill. */
export function pricingFor(terms: QuoteTermsSource, cadenceSec: CadenceSec, load: WindowLoad | undefined): Pricing {
  return {
    terms: {
      ...quoteCurve(terms, cadenceSec),
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
  /** The σ the fill would carry (`fillMark`). */
  mark: SigmaPair;
  pricing: Pricing;
  stake: bigint;
  /** The mode's two buttons' bands (`offerOf`); the second is absent for Range. */
  offer: readonly [BandSpecLike | undefined, BandSpecLike | undefined];
  /** Dollars, or points for a basket (the distance to the line reads in it). */
  unit?: PriceUnit;
  /** The open call and its band's shape, when there is one. */
  position: { call: QuotePosition; band: BandSpecLike } | undefined;
  /** The offered side being hovered or focused (0 or 1): its winning region previews on the chart. */
  preview?: 0 | 1 | null;
  /** The market's slippage limit (`slippageE6`, D-300): the quotes carry the limits a tap signs (R5.8). */
  slipE6?: bigint | undefined;
}

/** The latest quotes, readable synchronously for the tap (the limit is the quote the user saw). */
export interface Quotes {
  first: OpenQuote | null;
  second: OpenQuote | null;
  close: CloseQuote | null;
  /** The least each would accept at a p99 2-second move against it (R5.8); null keeps the tolerance on the quote. */
  limits?: { first: bigint | null; second: bigint | null; close: bigint | null };
}

/** One tick as the reaction engine reads it: the price and, holding a call, its result as a share of the stake. */
export interface QuoteTick {
  t: number;
  price: number;
  position: ReactionPosition | null;
}

export interface QuotePass {
  limits: NonNullable<Quotes["limits"]>;
  first: OpenQuote | null;
  second: OpenQuote | null;
  close: CloseQuote | null;
  /** Under each button: "Pays 2.14× · $10.70", or "—" when that side has no price now. */
  firstLine: string;
  secondLine: string;
  /** One sentence outside the buttons when a side has no price, else null (F8: never on a coloured button). */
  note: string | null;
  /** "▲ $12.40 (0.015%) above the line". */
  lineText: string;
  /** What cashing out returns now (null when it can't: none held, or beyond the pool's bounds) and the PnL (D-303). */
  proceeds: bigint | null;
  pnl: bigint | null;
  overlay: ChartOverlay;
  /** The open call as the reaction engine reads it. */
  reading: ReactionPosition | null;
}

export const dollars = (v: bigint) => `$${formatUnits(v < 0n ? -v : v, DOLLAR_DECIMALS, CENTS)}`;
export const signedDollars = (v: bigint) => `${v < 0n ? "−" : "+"}${dollars(v)}`;
/** Under $10 an amount shows four decimals — a sub-cent fee isn't "$0.00", a $1 trade's PnL visibly ticks; two above. */
const FINE_BELOW = 10_000_000n;
const FINE_DECIMALS = 4;
export const fineDollars = (v: bigint) => {
  const abs = v < 0n ? -v : v;
  return `$${formatUnits(abs, DOLLAR_DECIMALS, abs < FINE_BELOW ? FINE_DECIMALS : CENTS)}`;
};

const UNPRICED = "—";

/** Under a call button: "Pays 1.92× · $9.60" (what comes back, the stake included), or "—" with no price now. */
export function oddsLine(q: OpenQuote | null, stake: bigint): string {
  if (!q || q.refusal) return UNPRICED;
  return `Pays ${formatUnits(multiplierE2(stake, q.payout), CENTS, CENTS)}× · ${dollars(q.payout)}`;
}

/** The chance in words for a button's accessible name ("about 51%"), or null with no price. */
export function chanceOf(q: OpenQuote | null): string | null {
  return q && !q.refusal ? `about ${(q.probE6 * PERCENT) / P_ONE}%` : null;
}

/**
 * Why a shown side has no price, in one sentence for outside the buttons (F8), or null when every shown side is
 * priced: the window's room is used up, or the price has run so far that one side is beyond the pool's 3–97 % bounds.
 */
export function quoteNote(quotes: readonly (OpenQuote | null)[]): string | null {
  if (quotes.some((q) => q?.refusal === "capacity")) return "This window is full · the next one opens soon";
  if (quotes.some((q) => q?.refusal === "price")) return "Too one-sided to price right now";
  if (quotes.some((q) => q === null)) return "Quote unavailable · retrying";
  return null;
}

const toPrice = (e8: bigint) => Number(e8) / E8;
/** A previewed side's shade: its direction's colour, Range's cyan (D-316). */
const ZONE_TONE: Readonly<Record<BandSpecLike["kind"], "up" | "down" | "range">> = {
  up: "up",
  moonshot: "up",
  down: "down",
  crash: "down",
  range: "range",
};
const lineLevel = (k: bigint): ChartLevel => ({ kind: "line", price: toPrice(k), label: "Line" });

/** A band's edges or strike as chart levels (Up and Down have none beyond K). */
function edgeLevels(band: BandSpecLike, k: bigint): ChartLevel[] {
  if (band.kind === "up" || band.kind === "down") return [];
  const e = bandEdgesE8(band, k);
  const label = band.kind === "range" ? "Range" : band.kind === "moonshot" ? "Moonshot" : "Crash";
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
  const w = { openE8: i.k, mark: i.mark, tauSec };
  const { terms, capacity } = i.pricing;
  const price = (b: BandSpecLike | undefined) =>
    b ? fitOpen(quoteOpen(b, w, spot, i.stake, terms), i.stake, capacity) : null;
  const [a, b] = i.offer;
  const first = price(a);
  const second = price(b);
  const slip = i.slipE6;
  const limitOf = (band: BandSpecLike | undefined, q: OpenQuote | null) =>
    band && q && !q.refusal && slip !== undefined ? openLimit(band, w, spot, i.stake, terms, slip) : null;
  const limits = { first: limitOf(a, first), second: limitOf(b, second), close: null as bigint | null };

  const diff = spot - i.k;
  const pct = i.k > 0n ? (diff * PERCENT_E3) / i.k : 0n;
  const lineText = `${diff >= 0n ? "▲" : "▼"} ${gapText(diff, i.k, i.unit)} (${formatUnits(pct < 0n ? -pct : pct, PERCENT_DECIMALS, PERCENT_DECIMALS)}%) ${diff >= 0n ? "above" : "below"} the line`;
  const shown = b ? [first, second] : [first];
  const base = {
    limits,
    first,
    second,
    firstLine: oddsLine(first, i.stake),
    secondLine: oddsLine(second, i.stake),
    note: quoteNote(shown),
    lineText,
  };

  const p = i.position;
  if (!p || p.call.state === "committed") {
    const preview = [a, b].flatMap((band) => (band && i.k > 0n ? edgeLevels(band, i.k) : []));
    const hovered = i.preview === 0 ? a : i.preview === 1 ? b : undefined;
    const shade = hovered && i.k > 0n ? bandEdgesE8(hovered, i.k) : null;
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
        zone: shade && {
          from: shade.low === null ? null : toPrice(shade.low),
          to: shade.high === null ? null : toPrice(shade.high),
        },
        zoneTone: hovered ? ZONE_TONE[hovered.kind] : null,
        levels: [lineLevel(i.k), ...preview],
      },
    };
  }
  const close = quoteClose(p.band, w, spot, p.call.payout, terms);
  if (slip !== undefined && !close.refusal) limits.close = closeLimit(p.band, w, spot, p.call.payout, terms, slip);
  const figures = callFigures(close, p.call.payout, p.call.stake, p.call.fillProbE6);
  const pnl = figures.pnl;
  const roiBps = pnl !== null && p.call.stake > 0n ? (pnl * BPS) / p.call.stake : 0n;
  const edges = bandEdgesE8(p.band, i.k);
  const reading = bandReading(p.band, i.k, spot);
  return {
    ...base,
    close,
    proceeds: figures.proceeds,
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
      winning: pnl === null ? bandOutcome(p.band, i.k, spot) === "win" : pnl >= 0n,
      pnlText: pnl === null ? null : signedDollars(pnl),
      pnlTrend: 0,
      line: toPrice(i.k),
      zone: {
        from: edges.low === null ? null : toPrice(edges.low),
        to: edges.high === null ? null : toPrice(edges.high),
      },
      zoneTone: null,
      levels: [
        lineLevel(i.k),
        ...edgeLevels(p.band, i.k),
        ...(p.call.entryE8 !== null
          ? [{ kind: "entry" as const, price: toPrice(p.call.entryE8), label: "Entry" }]
          : []),
        ...heldLevels(p, { band: p.band, lineE8: i.k, mark: i.mark, terms }, i.expiry, i.nowSec),
      ],
      band: p.call.entryE8 === null ? null : toPrice(p.call.entryE8),
    },
  };
}

/** B/E and the armed exit as levels (R5.6): where cashing out returns the stake, and the exit's bids as prices. */
function heldLevels(
  p: { call: QuotePosition; band: BandSpecLike },
  m: { band: BandSpecLike; lineE8: bigint; mark: SigmaPair; terms: QuoteTerms },
  expiry: number,
  nowSec: number,
): ChartLevel[] {
  const c = { stake: p.call.stake, payout: p.call.payout, expiry, exit: p.call.exit };
  const be = callBreakEvenE8(c, m, nowSec);
  const exit = callExitLevelsE8(c, m, nowSec);
  const out: ChartLevel[] = [];
  if (be !== null) out.push({ kind: "be", price: toPrice(be), label: "B/E" });
  if (exit.tp !== null) out.push({ kind: "tp", price: toPrice(exit.tp), label: "TP" });
  if (exit.sl !== null) out.push({ kind: "sl", price: toPrice(exit.sl), label: "SL" });
  if (exit.trail !== null) out.push({ kind: "trail", price: toPrice(exit.trail), label: "Trail" });
  return out;
}

/** Which way a money figure moved, compared as bigints (−1, 0, 1). */
export const trendOf = (was: bigint | null, now: bigint): number =>
  was === null || was === now ? 0 : now > was ? 1 : -1;
