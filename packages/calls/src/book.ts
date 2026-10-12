/**
 * The live book (R5.1–R5.2, D-303): every open position valued at a price, the Tradash way, one copy for both apps.
 * - A call's PnL counts from the model's fair chance at its fill (`Filled.probE6`): shares × (chance now − chance at
 *   the fill), so it starts at $0.00 and moves with the price; the spread both ways is its Fees row. What Cash out
 *   returns is the exact bid (`quoteClose`), the contract's own sum.
 * - A ride's PnL is (mark − entry) × size; CLOSE returns its equity less the close fee (the taker rate, so at least
 *   that) and, in its first seconds, the early-close fee.
 * - Colour follows PnL ≥ 0 (zero is a win, as Tradash's).
 * Pure: `use-live-book.ts` feeds it prices and writes the result where the screens read it.
 */
import { type CadenceSec, FILL_DELAY_SEC, LOCKOUT_SEC } from "@senryo/config";
import { type BandShape, type CloseQuote, P_ONE, type QuoteTerms, quoteClose, type SigmaPair } from "@senryo/core";

const BPS = 10_000n;

/**
 * Where a position stands now:
 * - `live`: valued and closable;
 * - `opening` / `closing`: waiting for the fill print of an open or a close;
 * - `locked`: a call in its last 20 s — valued, cash-out closed until it settles;
 * - `too-sure`: a call beyond the pool's 3–97 % bounds — valued at the model, cash-out refused, it pays at expiry;
 * - `settling`: past its end, the result on its way;
 * - `no-price`: the market's price (or the call's line) isn't here yet.
 */
export type BookState = "live" | "opening" | "closing" | "locked" | "too-sure" | "settling" | "no-price";

export interface BookEntry {
  key: string;
  kind: "call" | "ride";
  id: bigint;
  symbol: string;
  /** "Up", "Range", "Moonshot"… for a call; "Up" / "Down" for a ride. */
  label: string;
  /** The side's direction (null for Range). */
  up: boolean | null;
  state: BookState;
  /** What went in: a call's stake left in it, a ride's margin. */
  cost: bigint;
  /** D-303 PnL (null when the position can't be valued now). */
  pnl: bigint | null;
  /** PnL ÷ cost in basis points. */
  roiBps: number | null;
  /** What closing now returns (null when it can't close now). */
  closeValue: bigint | null;
  /** What the position counts for in equity: its close value, else its fair value, else its cost. */
  worth: bigint;
  /** The spread or fees, both ways (null unvalued). */
  fees: bigint | null;
  /** When it ends (a call's expiry, a ride's end of life), unix seconds. */
  endsAt: number | null;
  /** The price it was valued at (null without a live price). */
  markE8: bigint | null;
  /** The fill's price (a call's entry print, a ride's entry). */
  entryE8: bigint | null;
  call?: {
    cadenceSec: CadenceSec;
    start: number;
    band: number;
    shares: bigint;
    lineE8: bigint | null;
    /** The standing exit in bids × 1e6 (null without one). */
    exit: BookCallExit | null;
  };
  ride?: {
    leverageBps: number;
    koE8: bigint | null;
    capE8: bigint | null;
    size: bigint;
    /** Where it breaks even after both fees (null before the fill). */
    breakEvenE8: bigint | null;
    /** The standing exit, prices × 1e8 and the trail in bps (null without one). */
    exit: BookRideExit | null;
  };
}

/** A call's standing exit as the api serves it (bids × 1e6; the trail's stop now). */
export interface BookCallExit {
  takeProfitE6: number;
  stopLossE6: number;
  floorE6: number;
  trailE6: number;
  trailStopE6: number | null;
}

/** A ride's standing exit as the api serves it. */
export interface BookRideExit {
  takeProfitE8: bigint;
  stopLossE8: bigint;
  floorE8: bigint;
  trailBps: number;
  trailStopE8: bigint | null;
}

const roi = (pnl: bigint | null, cost: bigint): number | null =>
  pnl === null || cost === 0n ? null : Number((pnl * BPS) / cost);

// ------------------------------------------------------------------------------------------------ calls

/** A call as the book needs it (`/v1/markets/tickets` row). */
export interface BookCall {
  ticketId: bigint;
  symbol: string;
  cadenceSec: number;
  start: number;
  band: number;
  state: string;
  stake: bigint;
  payout: bigint;
  entryE8: bigint | null;
  fillProbE6: number | null;
  exit: BookCallExit | null;
}

export interface CallMarket {
  /** The band's shape (the series' menu). */
  band: BandShape | undefined;
  /** K, the window's open print. */
  lineE8: bigint | undefined;
  /** The σ the close would carry (`fillMark`). */
  mark: SigmaPair | undefined;
  /** The live price × 1e8, when the market's price is live. */
  spotE8: bigint | undefined;
  /** The series' spread curve (`quoteCurve` for its lane). */
  terms: QuoteTerms | undefined;
}

export const callKey = (id: bigint) => `call:${id}`;
export const rideKey = (id: bigint) => `ride:${id}`;

/**
 * A held call's figures from its close quote (D-303): the PnL from the fair price at the fill (a call filled before
 * that was recorded counts from its stake), the spread both ways as fees, and the exact proceeds — null when the
 * pool refuses the close for price (beyond 3–97 %: it pays at expiry instead).
 */
export function callFigures(
  close: CloseQuote,
  shares: bigint,
  stake: bigint,
  fillProbE6: number | null,
): { pnl: bigint | null; fees: bigint | null; proceeds: bigint | null; fairNow: bigint } {
  const fairNow = (shares * close.probE6) / P_ONE;
  const fairAtFill = fillProbE6 === null ? null : (shares * BigInt(fillProbE6)) / P_ONE;
  const proceeds = close.refusal ? null : close.proceeds;
  const pnl = fairAtFill !== null ? fairNow - fairAtFill : proceeds !== null ? proceeds - stake : null;
  const fees = fairAtFill !== null ? stake - fairAtFill + (proceeds === null ? 0n : fairNow - proceeds) : null;
  return { pnl, fees, proceeds, fairNow };
}

/** A call's value at `nowSec` (server time). */
export function valueCall(c: BookCall, m: CallMarket, nowSec: number, label: string): BookEntry {
  const cadence = c.cadenceSec as CadenceSec;
  const expiry = c.start + c.cadenceSec;
  const up = m.band ? (m.band.kind === "range" ? null : m.band.kind === "up" || m.band.kind === "moonshot") : null;
  const base: BookEntry = {
    key: callKey(c.ticketId),
    kind: "call",
    id: c.ticketId,
    symbol: c.symbol,
    label,
    up,
    state: "no-price",
    cost: c.stake,
    pnl: null,
    roiBps: null,
    closeValue: null,
    worth: c.stake,
    fees: null,
    endsAt: expiry,
    markE8: m.spotE8 ?? null,
    entryE8: c.entryE8,
    call: {
      cadenceSec: cadence,
      start: c.start,
      band: c.band,
      shares: c.payout,
      lineE8: m.lineE8 ?? null,
      exit: c.exit,
    },
  };
  if (c.state === "committed") return { ...base, state: "opening" };
  if (!m.band || m.lineE8 === undefined || !m.mark || m.spotE8 === undefined || !m.terms) return base;
  const terms = m.terms;
  const tauSec = BigInt(Math.max(0, expiry - (nowSec + FILL_DELAY_SEC)));
  const w = { openE8: m.lineE8, mark: m.mark, tauSec };
  const close = quoteClose(m.band, w, m.spotE8, c.payout, terms);
  const { pnl, fees, proceeds, fairNow } = callFigures(close, c.payout, c.stake, c.fillProbE6);
  const state: BookState =
    c.state === "closing"
      ? "closing"
      : nowSec >= expiry
        ? "settling"
        : nowSec >= expiry - LOCKOUT_SEC
          ? "locked"
          : close.refusal
            ? "too-sure"
            : "live";
  return {
    ...base,
    state,
    pnl,
    roiBps: roi(pnl, c.stake),
    closeValue: state === "live" ? proceeds : null,
    worth: proceeds ?? fairNow,
    fees,
  };
}

/** What a call's levels need of its market: the band's shape, K, the σ a close carries and the lane's curve. */
export interface CallLevelMarket {
  band: BandShape;
  lineE8: bigint;
  mark: SigmaPair;
  terms: QuoteTerms;
}

/**
 * The spot at which a held call's bid crosses `bidE6` at this moment, by bisection on the exact bid (`quoteClose`) —
 * it moves as time passes. Null for Range (two such prices) or when no price inside ±`spanBps` of K reaches it.
 */
export function callSpotAtBid(
  c: { payout: bigint; expiry: number },
  m: CallLevelMarket,
  nowSec: number,
  bidE6: bigint,
  spanBps = SPAN_BPS,
): bigint | null {
  if (m.band.kind === "range") return null;
  const tauSec = BigInt(Math.max(0, c.expiry - (nowSec + FILL_DELAY_SEC)));
  const w = { openE8: m.lineE8, mark: m.mark, tauSec };
  const rising = m.band.kind === "up" || m.band.kind === "moonshot";
  const under = (spot: bigint) => quoteClose(m.band, w, spot, c.payout, m.terms).bidE6 < bidE6;
  let lo = m.lineE8 - (m.lineE8 * spanBps) / BPS;
  let hi = m.lineE8 + (m.lineE8 * spanBps) / BPS;
  // Up-like: the bid rises with the price, so it's under the target below the crossing; down-like: above it.
  if (under(rising ? hi : lo) || !under(rising ? lo : hi)) return null;
  for (let i = 0; i < BISECT_STEPS && hi - lo > 1n; i += 1) {
    const mid = (lo + hi) / 2n;
    if (under(mid) === rising) lo = mid;
    else hi = mid;
  }
  return rising ? hi : lo;
}
const BISECT_STEPS = 48;
const SPAN_BPS = 200n;

/** Where a call breaks even: the spot at which cashing out returns its stake (a share's bid = stake ÷ shares). */
export function callBreakEvenE8(
  c: { stake: bigint; payout: bigint; expiry: number },
  m: CallLevelMarket,
  nowSec: number,
): bigint | null {
  if (c.payout === 0n) return null;
  return callSpotAtBid(c, m, nowSec, (c.stake * P_ONE + c.payout - 1n) / c.payout);
}

/** A held call's exit levels as prices on the chart: take-profit, stop and the trail's stop now (R5.6). */
export function callExitLevelsE8(
  c: { payout: bigint; expiry: number; exit: BookCallExit | null },
  m: CallLevelMarket,
  nowSec: number,
): { tp: bigint | null; sl: bigint | null; trail: bigint | null } {
  const at = (bid: number | null | undefined) => (bid ? callSpotAtBid(c, m, nowSec, BigInt(bid)) : null);
  return { tp: at(c.exit?.takeProfitE6), sl: at(c.exit?.stopLossE6), trail: at(c.exit?.trailStopE6) };
}

// ------------------------------------------------------------------------------------------------ totals

export interface BookTotals {
  /** Cash + every position's worth (Tradash's equity pill). */
  equity: bigint | null;
  /** Σ PnL over the valued positions. */
  pnl: bigint;
  /** Σ cost of the valued positions (the ROI's base). */
  cost: bigint;
  roiBps: number | null;
  /** Positions that can't be valued now: left out of `pnl`, never counted as 0. */
  unpriced: number;
  count: number;
  /** Positions Close all would close now. */
  closable: number;
}

export function bookTotals(entries: readonly BookEntry[], cash: bigint | undefined): BookTotals {
  let pnl = 0n;
  let cost = 0n;
  let worth = 0n;
  let unpriced = 0;
  let closable = 0;
  for (const e of entries) {
    worth += e.worth;
    if (e.closeValue !== null) closable += 1;
    if (e.pnl === null) {
      unpriced += 1;
      continue;
    }
    pnl += e.pnl;
    cost += e.cost;
  }
  return {
    equity: cash === undefined ? null : cash + worth,
    pnl,
    cost,
    roiBps: roi(cost > 0n ? pnl : null, cost),
    unpriced,
    count: entries.length,
    closable,
  };
}
