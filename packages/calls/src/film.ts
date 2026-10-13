/**
 * The replay film (Q3, D-350; Codex direction 17 §2–3): one trade as plain data both apps draw and both exporters
 * encode — what you watch is what you post. `filmOf` lays the trade on a timeline once:
 * - R = clamp(life, 6 s, 12 s); the film runs R + 2 s at 30 fps;
 * - 0–0.6 s: the market before the fill (when it's known), neutral; IN lands at 0.6 s;
 * - the fill → exit maps linearly into 0.6 s … R − 0.4 s; the price then stops at the authoritative exit while the PnL
 *   lands on the realised result; the last frame holds 2 s (it is also the poster);
 * - the price range is eased per frame (18 % padding, grow 0.35, shrink 0.06) and stored, so a frame is a pure function
 *   of film time and seeking and export reproduce it exactly;
 * - the cue track (open at IN, the profit ladder at +10/25/50/100 %, adverse below −10 %, close at OUT, the verdict
 *   240 ms after) uses only existing cues.
 * Prices are numbers in the market's unit, money in dollars (display only — the receipt's figures stay bigint), times in
 * ms; an unknown PnL stays null. Plain arrays and numbers only, so the phone's export worklet can take it as is.
 */
import type { ReplaySample } from "./replay.ts";

export const FILM_FPS = 30;
export const FILM_RUN_MAX_MS = 12_000;
export const FILM_RUN_MIN_MS = 6_000;
export const FILM_HOLD_MS = 2_000;
/** Before the fill: the market's context, then IN. */
export const FILM_LEAD_MS = 600;
/** The price stops this long before the run ends while the PnL lands on the realised result. */
export const FILM_LAND_MS = 400;
/** The head's place across the plot (Fomo's x 594 of 48–824). */
export const FILM_HEAD_AT = 0.7;
/** The window behind the head, as a share of the trade's life. */
const WINDOW_SHARE = 0.45;
const RANGE_PAD = 0.18;
const GROW = 0.35;
const SHRINK = 0.06;
const MS = 1_000;
const E6 = 1e6;
const BPS = 10_000;
/** The verdict cue follows OUT by this much. */
const VERDICT_AFTER_MS = 240;
const LADDER_GAP_MS = 400;
/** ROI tiers that play the profit ladder once each, and the drawdown that plays `adverse` once (bps). */
const TIER = { tenth: 1_000, quarter: 2_500, half: 5_000, double: 10_000 } as const;
export const FILM_PROFIT_TIERS_BPS = [TIER.tenth, TIER.quarter, TIER.half, TIER.double] as const;
const ADVERSE_BPS = -1_000;

export type FilmProvenance = { kind: "recorded" } | { kind: "partial"; coveragePct: number } | { kind: "rebuilt" };

export interface FilmMoment {
  kind: "in" | "out";
  ms: number;
  price: number;
  /** IN: the fill time ("14:02:31"); OUT: the reason and time ("Trail · 14:06:11"). */
  caption: string;
  /** "OUT 25%" for a partial exit; "OUT · Settled" for a settlement. */
  label: string;
}

export interface FilmLevel {
  kind: "line" | "low" | "high" | "entry" | "ko" | "cap";
  price: number;
}

export type FilmCue = "open" | "profit" | "adverse" | "close" | "win" | "loss" | "refund";

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
  windowMs: number;
  times: number[];
  prices: number[];
  /** PnL in dollars at each sample (null where unknown). */
  pnls: (number | null)[];
  lows: number[];
  highs: number[];
  cues: { at: number; cue: FilmCue; step: number }[];
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

function extentBetween(f: Film, from: number, to: number, alwaysIn: readonly number[]): [number, number] {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (let i = sampleIndex(f, from); i <= sampleIndex(f, to); i++) {
    const p = f.prices[i] ?? 0;
    lo = Math.min(lo, p);
    hi = Math.max(hi, p);
  }
  for (const p of alwaysIn) {
    lo = Math.min(lo, p);
    hi = Math.max(hi, p);
  }
  const span = hi - lo || Math.abs(hi) * RANGE_PAD || 1;
  return [lo - span * RANGE_PAD, hi + span * RANGE_PAD];
}

function cueTrack(f: Film): Film["cues"] {
  const cues: Film["cues"] = [{ at: FILM_LEAD_MS, cue: "open", step: 0 }];
  const cost = f.input.cost;
  if (cost && cost > 0) {
    let tier = 0;
    let lastLadder = Number.NEGATIVE_INFINITY;
    let adverse = false;
    for (let i = 0; i < f.times.length; i++) {
      const pnl = f.pnls[i];
      const ms = f.times[i] ?? 0;
      if (pnl === null || pnl === undefined || ms < f.fillMs) continue;
      const roi = (pnl / cost) * BPS;
      const at = filmTimeAt(f, ms);
      const next = FILM_PROFIT_TIERS_BPS[tier];
      if (next !== undefined && roi >= next && at - lastLadder >= LADDER_GAP_MS) {
        cues.push({ at, cue: "profit", step: tier });
        lastLadder = at;
        tier += 1;
      }
      if (!adverse && roi <= ADVERSE_BPS) {
        cues.push({ at, cue: "adverse", step: 0 });
        adverse = true;
      }
    }
  }
  if (f.input.exit) {
    const out = f.runMs - FILM_LAND_MS;
    cues.push({ at: out, cue: "close", step: 0 });
    if (f.input.verdict) cues.push({ at: out + VERDICT_AFTER_MS, cue: f.input.verdict, step: 0 });
  }
  return cues.sort((a, b) => a.at - b.at);
}

export function filmOf(input: FilmInput): Film | null {
  const pts = input.samples.filter((s) => Number.isFinite(s[1]));
  // The authoritative end lands as its own sample, never written over an arbitrary last observation.
  if (input.exit && (pts.at(-1)?.[0] ?? 0) <= input.exit.ms) {
    pts.push([
      input.exit.ms,
      input.exit.price,
      input.realised === null ? null : String(Math.round(input.realised * E6)),
    ]);
  }
  const first = pts[0];
  const last = pts.at(-1);
  if (!first || !last || pts.length < 2 || last[0] <= input.fillMs) return null;
  const fillMs = Math.max(first[0], input.fillMs);
  const life = last[0] - fillMs;
  const runMs = Math.min(FILM_RUN_MAX_MS, Math.max(FILM_RUN_MIN_MS, life));
  const film: Film = {
    input,
    runMs,
    totalMs: runMs + FILM_HOLD_MS,
    fromMs: first[0],
    fillMs,
    toMs: last[0],
    windowMs: Math.max(MS, life * WINDOW_SHARE),
    times: pts.map((s) => s[0]),
    prices: pts.map((s) => s[1]),
    pnls: pts.map((s) => (s[2] === null ? null : Number(s[2]) / E6)),
    lows: [],
    highs: [],
    cues: [],
  };
  // The line and a range's edges stay in view; a ride's far knock-out and cap become edge labels instead.
  const kept = input.levels
    .filter((l) => l.kind === "line" || l.kind === "low" || l.kind === "high")
    .map((l) => l.price);
  const frames = Math.ceil((runMs / MS) * FILM_FPS) + 1;
  let [lo, hi] = extentBetween(film, film.fromMs, film.fillMs, kept);
  for (let i = 0; i < frames; i++) {
    const at = marketAt(film, (i / FILM_FPS) * MS);
    const [tLo, tHi] = extentBetween(film, at - film.windowMs, at, kept);
    lo += (tLo - lo) * (tLo < lo ? GROW : SHRINK);
    hi += (tHi - hi) * (tHi > hi ? GROW : SHRINK);
    film.lows.push(lo);
    film.highs.push(hi);
  }
  film.cues = cueTrack(film);
  return film;
}
