/**
 * The replay film (Q3, D-350; Codex direction 17 §2–3): one trade as plain data both apps draw and both exporters
 * encode — what you watch is what you post. `filmOf` lays the trade on a timeline once:
 * - R = 6 s + 4 s per decade of minutes of the trade's life (6 – 18 s); the film runs R + 2 s at 30 fps;
 * - the view keeps the first moment at its left edge and widens with the film, so the last frame is the whole trade;
 * - 0–0.6 s: the market before the fill (when it's known), neutral; IN lands at 0.6 s;
 * - the fill → exit maps linearly into 0.6 s … R − 0.4 s; the price then stops at the authoritative exit while the PnL
 *   lands on the realised result; the last frame holds 2 s (it is also the poster);
 * - the price range is eased per frame (18 % padding, grow 0.35, shrink 0.06, never cutting the head or the visible
 *   path, never thinner than 0.05 % of the price) and stored, so a frame is a pure function of film time and seeking and
 *   export reproduce it exactly;
 * - the path ends at the authoritative exit: anything recorded after it is dropped, so the head stops where OUT lands;
 * - the entry (or a call's line) stays inside the range; a ride's far knock-out and cap don't stretch it;
 * - the soundtrack is `filmSound` (film-sound.ts): the live terminal's sound over this timeline.
 * Prices are numbers in the market's unit, money in dollars (display only — the receipt's figures stay bigint), times in
 * ms; an unknown PnL stays null. Plain arrays and numbers only, so the phone's export worklet can take it as is.
 */
import type { ReplaySample } from "./replay.ts";

export const FILM_FPS = 30;
export const FILM_RUN_MAX_MS = 18_000;
export const FILM_RUN_MIN_MS = 6_000;
/** The run grows with the trade's life: 6 s plus 4 s per decade of minutes (a minute ≈ 7 s, an hour ≈ 13 s). */
const RUN_PER_DECADE_MS = 4_000;
const MINUTE_MS = 60_000;
export const FILM_HOLD_MS = 2_000;
/** Before the fill: the market's context, then IN. */
export const FILM_LEAD_MS = 600;
/** The price stops this long before the run ends while the PnL lands on the realised result. */
export const FILM_LAND_MS = 400;
/** The head's place across the plot (Fomo's x 594 of 48–824). */
export const FILM_HEAD_AT = 0.7;
/**
 * The view keeps the film's first moment at its left edge and widens as the film plays, so the last frame shows the
 * whole trade; early on it is at least this share of the whole span wide, so the line never starts stretched.
 */
const MIN_WINDOW_SHARE = 0.25;
/** The least market before the fill worth showing, as a share of the trade's life (less is a sliver at the head). */
const MIN_LEAD_SHARE = 0.02;
const RANGE_PAD = 0.18;
/** The least height a range gets, as a share of the price. */
const MIN_SPAN_SHARE = 0.0005;
const GROW = 0.35;
const SHRINK = 0.06;
const MS = 1_000;
const E6 = 1e6;

export type FilmProvenance =
  | { kind: "recorded" }
  | { kind: "partial"; coveragePct: number }
  /** Recorded, with the stretches this device missed filled from 1-minute candles. */
  | { kind: "filled" }
  /** Nothing recorded here: candles only. */
  | { kind: "rebuilt" };

export interface FilmMoment {
  kind: "in" | "out";
  ms: number;
  price: number;
  /** The tooltip's word: "OPEN"; at OUT how it ended ("CLOSE", "KO", "TRAIL", "CASH OUT", "SETTLED"). */
  title: string;
  /** What went in (IN) or came back (OUT), in USDC units as a decimal string; null when unknown. */
  amount: string | null;
}

export interface FilmLevel {
  kind: "line" | "low" | "high" | "entry" | "ko" | "cap";
  price: number;
}

export interface FilmInput {
  kind: "call" | "ride";
  symbol: string;
  up: boolean | null;
  /** The path: market context before the fill may lead; recorded or rebuilt samples. */
  samples: readonly ReplaySample[];
  fillMs: number;
  /** The authoritative exit (null while live: the film is a "Live" snapshot to the last sample). */
  exit: { ms: number; price: number } | null;
  /** The ROI denominator: a call's stake, a ride's original margin + open fee (null when unknown). */
  cost: number | null;
  /** The realised result once ended (dollars); null while live or unknown. */
  realised: number | null;
  verdict: "win" | "loss" | "refund" | null;
  moments: readonly FilmMoment[];
  levels: readonly FilmLevel[];
  provenance: FilmProvenance;
}

export interface Film {
  input: FilmInput;
  runMs: number;
  totalMs: number;
  /** Market time at the start of the lead-in, the fill and the end. */
  fromMs: number;
  fillMs: number;
  toMs: number;
  /** The view's least width (ms); it is `now − fromMs` once that is wider (`windowAt`). */
  minWindowMs: number;
  times: number[];
  prices: number[];
  /** PnL in dollars at each sample (null where unknown). */
  pnls: (number | null)[];
  lows: number[];
  highs: number[];
}

/** How much market the view spans at market time `now`: from the film's first moment, never under its least width. */
export function windowAt(f: Pick<Film, "fromMs" | "minWindowMs">, now: number): number {
  return Math.max(f.minWindowMs, now - f.fromMs);
}

/** Market time at film time `t` (ms). */
export function marketAt(f: Film, t: number): number {
  if (t <= FILM_LEAD_MS) return f.fromMs + (f.fillMs - f.fromMs) * (FILM_LEAD_MS > 0 ? t / FILM_LEAD_MS : 1);
  const end = f.runMs - FILM_LAND_MS;
  const k = Math.min(1, (t - FILM_LEAD_MS) / Math.max(1, end - FILM_LEAD_MS));
  return f.fillMs + (f.toMs - f.fillMs) * k;
}

/** Film time at market time `ms` (the inverse of `marketAt` over the run). */
export function filmTimeAt(f: Film, ms: number): number {
  if (ms <= f.fillMs)
    return f.fillMs > f.fromMs ? ((ms - f.fromMs) / (f.fillMs - f.fromMs)) * FILM_LEAD_MS : FILM_LEAD_MS;
  const end = f.runMs - FILM_LAND_MS;
  return FILM_LEAD_MS + ((ms - f.fillMs) / Math.max(1, f.toMs - f.fillMs)) * (end - FILM_LEAD_MS);
}

/** The last sample at or before market time `ms` (binary search). */
export function sampleIndex(f: Film, ms: number): number {
  let lo = 0;
  let hi = f.times.length - 1;
  if (hi < 0 || ms <= (f.times[0] ?? 0)) return 0;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((f.times[mid] ?? 0) <= ms) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * The prices to show between two market times: the padded range to ease toward, and the raw extremes the eased range
 * must never cut (the sample after `to` included, since the head interpolates toward it). A near-flat stretch is given
 * at least 0.05 % of the price in height, so noise never reads as a spike.
 */
function extentBetween(
  f: Film,
  from: number,
  to: number,
  alwaysIn: readonly number[],
): { lo: number; hi: number; rawLo: number; rawHi: number } {
  let rawLo = Number.POSITIVE_INFINITY;
  let rawHi = Number.NEGATIVE_INFINITY;
  const last = Math.min(f.prices.length - 1, sampleIndex(f, to) + 1);
  for (let i = sampleIndex(f, from); i <= last; i++) {
    const p = f.prices[i] ?? 0;
    rawLo = Math.min(rawLo, p);
    rawHi = Math.max(rawHi, p);
  }
  for (const p of alwaysIn) {
    rawLo = Math.min(rawLo, p);
    rawHi = Math.max(rawHi, p);
  }
  const mid = (rawLo + rawHi) / 2;
  const span = Math.max(rawHi - rawLo, Math.abs(mid) * MIN_SPAN_SHARE) || 1;
  const pad = span * RANGE_PAD;
  return { lo: mid - span / 2 - pad, hi: mid + span / 2 + pad, rawLo, rawHi };
}

export function filmOf(input: FilmInput): Film | null {
  const exit = input.exit;
  // Nothing recorded after the exit plays; the authoritative end lands as its own last sample.
  let pts = input.samples.filter((s) => Number.isFinite(s[1]) && (exit === null || s[0] < exit.ms));
  if (exit) pts.push([exit.ms, exit.price, input.realised === null ? null : String(Math.round(input.realised * E6))]);
  const head = pts[0];
  const last = pts.at(-1);
  if (!head || !last || pts.length < 2 || last[0] <= input.fillMs) return null;
  const fillMs = Math.max(head[0], input.fillMs);
  const life = last[0] - fillMs;
  // A few seconds before the fill aren't context at this scale (a sliver at the head): the film starts at the fill.
  if (fillMs - head[0] < life * MIN_LEAD_SHARE) {
    const inPrice = input.moments.find((m) => m.kind === "in")?.price ?? head[1];
    pts = [[fillMs, inPrice, null], ...pts.filter((s) => s[0] > fillMs)];
  }
  const first = pts[0] ?? head;
  const runMs = Math.min(
    FILM_RUN_MAX_MS,
    Math.max(FILM_RUN_MIN_MS, FILM_RUN_MIN_MS + RUN_PER_DECADE_MS * Math.log10(life / MINUTE_MS + 1)),
  );
  const film: Film = {
    input,
    runMs,
    totalMs: runMs + FILM_HOLD_MS,
    fromMs: first[0],
    fillMs,
    toMs: last[0],
    minWindowMs: Math.max(MS, (last[0] - first[0]) * MIN_WINDOW_SHARE),
    times: pts.map((s) => s[0]),
    prices: pts.map((s) => s[1]),
    pnls: pts.map((s) => (s[2] === null ? null : Number(s[2]) / E6)),
    lows: [],
    highs: [],
  };
  // The entry, the line and a range's edges stay in view; a ride's far knock-out and cap only show once reached.
  const kept = input.levels.filter((l) => l.kind !== "ko" && l.kind !== "cap").map((l) => l.price);
  const frames = Math.ceil((runMs / MS) * FILM_FPS) + 1;
  const start = extentBetween(film, film.fromMs, film.fillMs, kept);
  let lo = start.lo;
  let hi = start.hi;
  for (let i = 0; i < frames; i++) {
    const at = marketAt(film, (i / FILM_FPS) * MS);
    const t = extentBetween(film, at - windowAt(film, at), at, kept);
    lo += (t.lo - lo) * (t.lo < lo ? GROW : SHRINK);
    hi += (t.hi - hi) * (t.hi > hi ? GROW : SHRINK);
    // Easing never leaves the head or the visible path outside the range: it grows at once to hold them.
    lo = Math.min(lo, t.rawLo);
    hi = Math.max(hi, t.rawHi);
    film.lows.push(lo);
    film.highs.push(hi);
  }
  return film;
}
