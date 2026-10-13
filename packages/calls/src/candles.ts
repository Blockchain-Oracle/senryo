/**
 * Candles for the terminal's candle view (R5.17; Tradash's `CandleSeries` by way of Owarine's `candles.ts`), both
 * engines: closed history from our one-minute archive (`/v1/prices/candles`), grouped into the chosen interval, plus
 * the forming candle built from live ticks — its high and low follow the raw ticks, its close the eased price —
 * rolling over at each bucket with a one-slot slide-in that decays ×0.86 a frame. Pure.
 */

import type { CandleRow } from "./session-history.ts";

export type CandleInterval = "1m" | "5m" | "15m" | "1h";
export const CANDLE_INTERVALS: readonly CandleInterval[] = ["1m", "5m", "15m", "1h"];
export const INTERVAL_SEC: Readonly<Record<CandleInterval, number>> = { "1m": 60, "5m": 300, "15m": 900, "1h": 3_600 };

export interface Candle {
  /** The bucket's start, in ms. */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

/** Most closed candles kept. */
export const CANDLE_CAP = 1_500;
/** The slide-in decays this much a frame. */
export const SLIDE_DECAY = 0.86;
const SLIDE_REST = 0.002;
/** Default px per candle: the plot width / 48, clamped; the pinch range. */
export const SPACING_MIN = 1.5;
export const SPACING_MAX = 40;
const SPACING_DEFAULT = { slots: 48, min: 5, max: 14 } as const;
const BODY_SHARE = 0.64;
/** Tradash's y-step: nice(max(2 · deviation · 1.15, 0.15 % of the price) / 15). */
const STEP = { spread: 2.3, floorShare: 0.0015, lines: 15 } as const;
const DETENT_SPLIT = 5;
/** A candle sits in the middle of its slot. */
const SLOT_MIDDLE = 0.5;
const MS = 1_000;
const E8 = 1e8;

export function defaultSpacing(plotW: number): number {
  "worklet";
  return Math.min(SPACING_DEFAULT.max, Math.max(SPACING_DEFAULT.min, plotW / SPACING_DEFAULT.slots));
}

export function bodyWidth(spacing: number): number {
  "worklet";
  return Math.max(1, Math.round(BODY_SHARE * spacing));
}

/**
 * The archive's minute rows (`[minute start s, o, h, l, c]` in e-8) grouped into `intervalSec` buckets, oldest first
 * (prices as numbers; buckets aligned to the interval like the lanes).
 */
export function groupCandles(rows: readonly CandleRow[], intervalSec: number): Candle[] {
  const out: Candle[] = [];
  for (const [ts, o, h, l, c] of rows) {
    const t = Math.floor(ts / intervalSec) * intervalSec * MS;
    const last = out.at(-1);
    if (last && last.t === t) {
      last.h = Math.max(last.h, h / E8);
      last.l = Math.min(last.l, l / E8);
      last.c = c / E8;
    } else out.push({ t, o: o / E8, h: h / E8, l: l / E8, c: c / E8 });
  }
  return out;
}

/**
 * The candles as plain data, so the phone's chart can hold them in its UI-thread state (worklets carry no classes); the
 * functions below are worklets, and the web's `CandleSeries` is a thin class over the same data and functions.
 */
export interface CandleData {
  intervalMs: number;
  closed: Candle[];
  forming: Candle | null;
  /** 1 right after a rollover, decaying to 0: the newest candle slides in from the right. */
  slide: number;
}

export function newCandles(intervalMs: number): CandleData {
  "worklet";
  return { intervalMs, closed: [], forming: null, slide: 0 };
}

/** Merges fetched candles (any order, overlapping allowed); the bucket still forming stays live. */
export function candleMerge(d: CandleData, rows: readonly Candle[], nowMs: number): void {
  "worklet";
  const current = Math.floor(nowMs / d.intervalMs) * d.intervalMs;
  const byT = new Map<number, Candle>();
  for (const c of d.closed) byT.set(c.t, c);
  for (const r of rows) {
    if (r.t >= current) {
      const f = d.forming;
      d.forming = f && f.t === r.t ? { ...r, h: Math.max(r.h, f.h), l: Math.min(r.l, f.l), c: f.c } : (f ?? { ...r });
      continue;
    }
    byT.set(r.t, { ...r });
  }
  d.closed = [...byT.values()].sort((a, b) => a.t - b.t).slice(-CANDLE_CAP);
}

/** A live tick: `raw` moves the high and low, `eased` is the close the eye follows. */
export function candleTick(d: CandleData, raw: number, eased: number, nowMs: number): void {
  "worklet";
  const bucket = Math.floor(nowMs / d.intervalMs) * d.intervalMs;
  const f = d.forming;
  if (!f || bucket > f.t) {
    if (f) {
      d.closed.push(f);
      if (d.closed.length > CANDLE_CAP) d.closed.shift();
      d.slide = 1;
    }
    const open = f?.c ?? eased;
    d.forming = { t: bucket, o: open, h: Math.max(open, raw), l: Math.min(open, raw), c: eased };
    return;
  }
  f.h = Math.max(f.h, raw);
  f.l = Math.min(f.l, raw);
  f.c = eased;
}

export function candleDecay(d: CandleData, k = SLIDE_DECAY): void {
  "worklet";
  d.slide = d.slide < SLIDE_REST ? 0 : d.slide * k;
}

/** The k-th candle from the newest (0 = forming). */
export function candleAt(d: CandleData, k: number): Candle | null {
  "worklet";
  if (k === 0) return d.forming;
  return d.closed[d.closed.length - k] ?? null;
}

export function candleCount(d: CandleData): number {
  "worklet";
  return d.closed.length + (d.forming ? 1 : 0);
}

/** The web's handle on the same data and functions. */
export class CandleSeries {
  readonly data: CandleData;

  constructor(intervalMs: number) {
    this.data = newCandles(intervalMs);
  }

  merge(rows: readonly Candle[], nowMs: number): void {
    candleMerge(this.data, rows, nowMs);
  }

  update(raw: number, eased: number, nowMs: number): void {
    candleTick(this.data, raw, eased, nowMs);
  }

  decay(k = SLIDE_DECAY): void {
    candleDecay(this.data, k);
  }

  at(k: number): Candle | null {
    return candleAt(this.data, k);
  }

  get count(): number {
    return candleCount(this.data);
  }

  get slide(): number {
    return this.data.slide;
  }
}

/** The x of the k-th newest candle's slot: `plotW − spacing·(0.5 + k − offset) + slide·spacing`. */
export function slotX(k: number, plotW: number, spacing: number, offset: number, slide: number): number {
  "worklet";
  return plotW - spacing * (SLOT_MIDDLE + k - offset) + slide * spacing;
}

/** Which k range is on screen. */
export function visibleRange(plotW: number, spacing: number, offset: number): { from: number; to: number } {
  "worklet";
  const slots = Math.ceil(plotW / spacing) + 2;
  return { from: Math.max(0, Math.floor(offset) - 1), to: Math.floor(offset) + slots };
}

/** The y-step from the visible bodies around `price` (Tradash's rule). */
export function candleStep(
  bodies: ReadonlyArray<{ o: number; c: number }>,
  price: number,
  nice: (x: number) => number,
): number {
  "worklet";
  let dev = 0;
  for (const b of bodies) dev = Math.max(dev, Math.abs(b.o - price), Math.abs(b.c - price));
  return nice(Math.max(STEP.spread * dev, STEP.floorShare * price) / STEP.lines);
}

/** The crosshair's snap point: a candle slot and a price bucket of step / 5 (a haptic detent each change). */
export function detent(
  x: number,
  price: number,
  view: { plotW: number; spacing: number; offset: number; slide: number },
  step: number,
): { k: number; price: number } {
  "worklet";
  const k = Math.max(
    0,
    Math.round((view.plotW + view.slide * view.spacing - x) / view.spacing - SLOT_MIDDLE + view.offset),
  );
  const bucket = step / DETENT_SPLIT;
  return { k, price: Math.round(price / bucket) * bucket };
}
