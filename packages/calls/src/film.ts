/**
 * The replay film (Q3, D-350; the owner's Fomo clip, research 14 §1): one trade turned into plain data both apps draw
 * and both exporters encode — what you watch is what you post. `filmOf` lays the trade on a timeline once: market time
 * mapped into a run of at most 12 s (a short trade is slowed to at least 6 s so it has a body), then a held last frame;
 * the price range eased as Fomo's (quick to grow, slow to shrink), precomputed per frame so a frame is a pure function
 * of film time; the moments (IN at the fill, OUT at the exit) with their captions. `frameAt` (film-frame.ts) reads it.
 *
 * Prices are numbers in the market's unit, money in dollars (display only — the receipt's figures stay bigint), times
 * in ms. Plain arrays and numbers only, so the phone's export worklet can take it as is.
 */
import type { ReplaySample } from "./replay.ts";

/** The film's frame rate: the player and both exporters step at it. */
export const FILM_FPS = 30;
export const FILM_RUN_MAX_MS = 12_000;
export const FILM_RUN_MIN_MS = 6_000;
/** The last frame holds this long (Fomo ≈ 2.1 s): it doubles as the poster. */
export const FILM_HOLD_MS = 2_000;
/** Where the head sits across the chart (Fomo pins it at ≈ 55 %): history left, the empty future right. */
export const FILM_HEAD_AT = 0.55;
/** How much of the trade's life the window behind the head shows. */
const WINDOW_SHARE = 0.45;
/** Room above and below the visible path, as a share of its span. */
const RANGE_PAD = 0.18;
/** Per-frame easing of the range toward its target: fast to grow, slow to shrink (Tradash's driven mode). */
const GROW = 0.35;
const SHRINK = 0.06;
const MS = 1_000;
const E6 = 1e6;

export interface FilmMoment {
  kind: "in" | "out";
  ms: number;
  price: number;
  /** "Up · $5.00 at 107.22", "Cashed out +$10.48". */
  caption: string;
}

export interface FilmLevel {
  kind: "line" | "low" | "high" | "ko" | "cap";
  price: number;
}

export interface FilmInput {
  kind: "call" | "ride";
  symbol: string;
  /** "BTC · Up · 5m", "BTC · Down · 10×". */
  title: string;
  up: boolean | null;
  samples: readonly ReplaySample[];
  /** The money that went in (stake or margin), dollars. */
  cost: number;
  /** The realised result once ended (dollars), null while open. */
  realised: number | null;
  moments: readonly FilmMoment[];
  levels: readonly FilmLevel[];
  /** True when part of the path came from 1-minute prices rather than this device. */
  partial: boolean;
}

export interface Film {
  input: FilmInput;
  runMs: number;
  totalMs: number;
  /** Market time at the first and last sample. */
  fromMs: number;
  toMs: number;
  /** The window behind the head, market ms. */
  windowMs: number;
  times: number[];
  prices: number[];
  /** PnL in dollars at each sample (the last known carried forward). */
  pnls: number[];
  /** The eased price range at each frame of the run. */
  lows: number[];
  highs: number[];
}

/** Market time at film time `t` (ms): linear over the run, held at the end. */
export function marketAt(f: Film, t: number): number {
  const k = Math.min(1, Math.max(0, t / f.runMs));
  return f.fromMs + (f.toMs - f.fromMs) * k;
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

function extentBetween(f: Film, from: number, to: number, alwaysIn: readonly number[]): [number, number] {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  const a = sampleIndex(f, from);
  const b = sampleIndex(f, to);
  for (let i = a; i <= b; i++) {
    const p = f.prices[i] ?? 0;
    if (p < lo) lo = p;
    if (p > hi) hi = p;
  }
  for (const p of alwaysIn) {
    if (p < lo) lo = p;
    if (p > hi) hi = p;
  }
  const span = hi - lo || Math.abs(hi) * RANGE_PAD || 1;
  return [lo - span * RANGE_PAD, hi + span * RANGE_PAD];
}

export function filmOf(input: FilmInput): Film | null {
  const pts = input.samples.filter((s) => Number.isFinite(s[1]));
  const first = pts[0];
  const last = pts.at(-1);
  if (!first || !last || pts.length < 2 || last[0] <= first[0]) return null;
  const span = last[0] - first[0];
  const runMs = Math.min(FILM_RUN_MAX_MS, Math.max(FILM_RUN_MIN_MS, span));
  let carried = 0;
  const pnls = pts.map((s) => {
    if (s[2] !== null) carried = Number(s[2]) / E6;
    return carried;
  });
  // A finished trade lands on its realised figure, which the last sample may not carry yet.
  if (input.realised !== null && pnls.length > 0) pnls[pnls.length - 1] = input.realised;
  const film: Film = {
    input,
    runMs,
    totalMs: runMs + FILM_HOLD_MS,
    fromMs: first[0],
    toMs: last[0],
    windowMs: Math.max(MS, span * WINDOW_SHARE),
    times: pts.map((s) => s[0]),
    prices: pts.map((s) => s[1]),
    pnls,
    lows: [],
    highs: [],
  };
  // The line stays in view for a call; a ride's far knock-out and cap don't stretch the chart flat.
  const kept = input.levels
    .filter((l) => l.kind === "line" || l.kind === "low" || l.kind === "high")
    .map((l) => l.price);
  const frames = Math.ceil((runMs / MS) * FILM_FPS) + 1;
  let [lo, hi] = extentBetween(film, film.fromMs, film.fromMs, kept);
  for (let i = 0; i < frames; i++) {
    const at = marketAt(film, (i / FILM_FPS) * MS);
    const [tLo, tHi] = extentBetween(film, at - film.windowMs, at, kept);
    lo += (tLo - lo) * (tLo < lo ? GROW : SHRINK);
    hi += (tHi - hi) * (tHi > hi ? GROW : SHRINK);
    film.lows.push(lo);
    film.highs.push(hi);
  }
  return film;
}
