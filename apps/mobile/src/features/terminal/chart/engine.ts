/**
 * The live chart's maths on the UI thread (worklets): Tradash's model as Owarine's web terminal re-implements it
 * (`owarine/web/src/features/terminal/chart/engine.ts`; canton-season3 `tradash/SPEC-chart.md` §2). The eased price is
 * pushed into a 600-sample ring on a fixed 60 Hz clock, so the plot is the last ~10 s of motion; the y-axis re-centres on
 * the eased price every frame at ±7.5 nice steps (0.01 % of price, frozen until the market changes).
 */

import {
  DECIMAL_BANDS,
  EPSILON,
  MAX_DECIMALS,
  MS_PER_SECOND,
  NICE_CUTS,
  NICE_STEPS,
  SAMPLE_HZ,
  SIGNIFICANT,
  THOUSANDS,
  ZERO_DECIMALS,
} from "./constants";

/** Samples on screen; ~10 s at the 60 Hz sample clock. */
export const SAMPLE_CAPACITY = 600;
export const SAMPLE_MS = MS_PER_SECOND / SAMPLE_HZ;
/** The plot spans this many grid steps top to bottom. */
export const SPAN_STEPS = 15;
/** One step ≈ this fraction of price before rounding to a nice number. */
export const STEP_FRACTION = 1e-4;
/** The left fraction of the plot that fades out (alpha 1 → .55 at 45 % of it → 0). */
export const FADE_FRACTION = 0.32;
/** Labels and ticks fade over this many px near an edge or the pill. */
export const EDGE_FADE_PX = 14;
const MAX_TICKS = 400;
const MINOR_PER_MAJOR = 5;

/** Tradash's nice step: 1, 2, 5 or 10 × 10ⁿ. */
export function niceStep(x: number): number {
  "worklet";
  if (!(x > 0) || !Number.isFinite(x)) return 1;
  const pow = 10 ** Math.floor(Math.log10(x));
  const m = x / pow;
  for (let i = 0; i < NICE_CUTS.length; i += 1) if (m < (NICE_CUTS[i] ?? 0)) return (NICE_STEPS[i] ?? 1) * pow;
  return (NICE_STEPS[NICE_CUTS.length] ?? 1) * pow;
}

export function stepFor(price: number): number {
  "worklet";
  return niceStep(STEP_FRACTION * Math.abs(price));
}

/** Display decimals by magnitude (`@senryo/core` `PRICE_DECIMAL_BANDS`): ≥1e5 → 1, ≥100 → 2, ≥10 → 3, ≥1 → 5, else 4 significant. */
export function priceDecimals(price: number): number {
  "worklet";
  const a = Math.abs(price);
  for (const band of DECIMAL_BANDS) if (a >= band.min) return band.decimals;
  if (a === 0) return ZERO_DECIMALS;
  return Math.min(MAX_DECIMALS, SIGNIFICANT - Math.floor(Math.log10(a)));
}

export function labelDecimals(price: number, step: number): number {
  "worklet";
  return Math.max(priceDecimals(price), Math.max(0, -Math.floor(Math.log10(step) + EPSILON)));
}

/** "81,234.5" — fixed decimals with thousands commas (no `Intl` on the UI runtime). */
export function formatFixed(value: number, decimals: number): string {
  "worklet";
  const fixed = Math.abs(value).toFixed(decimals);
  const dot = fixed.indexOf(".");
  const int = dot < 0 ? fixed : fixed.slice(0, dot);
  const frac = dot < 0 ? "" : fixed.slice(dot);
  let grouped = "";
  for (let i = 0; i < int.length; i += 1) {
    if (i > 0 && (int.length - i) % THOUSANDS === 0) grouped += ",";
    grouped += int[i];
  }
  return `${value < 0 ? "−" : ""}${grouped}${frac}`;
}

export function formatUsd(price: number, decimals: number = priceDecimals(price)): string {
  "worklet";
  return `$${formatFixed(price, decimals)}`;
}

/** A value in its unit: "$81,234.56", or "1,003.12 pts" for a basket (D-286). */
export function formatValue(price: number, decimals: number, points: boolean): string {
  "worklet";
  return points ? `${formatFixed(price, decimals)} pts` : `$${formatFixed(price, decimals)}`;
}

/** "+$1,234.56" / "−$3.20". */
export function formatSignedUsd(value: number, decimals = 2): string {
  "worklet";
  return `${value < 0 ? "−" : "+"}$${formatFixed(Math.abs(value), decimals)}`;
}

export interface YWindow {
  center: number;
  half: number;
  top: number;
  bottom: number;
}

export function yOf(price: number, w: YWindow): number {
  "worklet";
  const mid = (w.top + w.bottom) / 2;
  return mid - ((price - w.center) / w.half) * ((w.bottom - w.top) / 2);
}

/** Grid values across `[lo, hi]`: a minor every step/5, a major every step; empty past MAX_TICKS. */
export function gridTicks(lo: number, hi: number, step: number): { value: number; major: boolean }[] {
  "worklet";
  const minor = step / MINOR_PER_MAJOR;
  if (!(minor > 0) || (hi - lo) / minor > MAX_TICKS) return [];
  const out: { value: number; major: boolean }[] = [];
  for (let k = Math.ceil(lo / minor); k * minor <= hi + EPSILON * Math.abs(hi); k += 1)
    out.push({ value: k * minor, major: k % MINOR_PER_MAJOR === 0 });
  return out;
}

/** Alpha near an edge or the pill: fades over EDGE_FADE_PX. */
export function edgeAlpha(distancePx: number): number {
  "worklet";
  return Math.min(1, Math.max(0, distancePx / EDGE_FADE_PX));
}
