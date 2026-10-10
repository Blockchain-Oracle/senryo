/**
 * The live chart's maths (Owarine `chart/engine.ts`, Tradash's model): pure, no DOM. The line is not time-based —
 * every frame the eased price is pushed into a 600-sample ring, so the plot is the last ~10 s of motion at the right
 * edge, and the y-axis re-centres on the eased price at ±7.5 frozen steps. Price text is `@senryo/core`'s.
 */
import { priceDecimals } from "@senryo/core";
import {
  CATMULL,
  DIGITS,
  EDGE_FADE_PX,
  EPSILON,
  MAX_TICKS,
  MINOR_PER_MAJOR,
  NICE_CUTS,
  NICE_STEPS,
  SAMPLE_CAPACITY,
  STEP_FRACTION,
  TICK_DECIMALS,
} from "./constants";

const TEN = 10;

export function niceStep(x: number): number {
  if (!(x > 0) || !Number.isFinite(x)) return 1;
  const pow = TEN ** Math.floor(Math.log10(x));
  const m = x / pow;
  const i = NICE_CUTS.findIndex((cut) => m < cut);
  return (NICE_STEPS[i < 0 ? NICE_STEPS.length - 1 : i] ?? 1) * pow;
}

/** The frozen grid step for a price (0.01 % of it, made nice). */
export const stepFor = (price: number): number => niceStep(STEP_FRACTION * Math.abs(price));

/** A grid label's decimals: the price's, or more when the step is finer. */
export function labelDecimals(price: number, step: number): number {
  return Math.max(priceDecimals(price), Math.max(0, -Math.floor(Math.log10(step) + EPSILON)));
}

/** A ring of the last `capacity` samples, oldest first when read. */
export class SampleRing {
  private readonly buf: Float64Array;
  private start = 0;
  private size = 0;

  constructor(readonly capacity = SAMPLE_CAPACITY) {
    this.buf = new Float64Array(capacity);
  }

  get length(): number {
    return this.size;
  }

  push(v: number): void {
    if (this.size < this.capacity) {
      this.buf[(this.start + this.size) % this.capacity] = v;
      this.size += 1;
    } else {
      this.buf[this.start] = v;
      this.start = (this.start + 1) % this.capacity;
    }
  }

  /** Fills the ring with one value: the chart starts flat and grows movement from the right. */
  fill(v: number): void {
    this.buf.fill(v);
    this.start = 0;
    this.size = this.capacity;
  }

  /** Loads a whole line, oldest first (a chart opening on real history, `fillLine`). */
  load(values: ArrayLike<number>): void {
    for (let i = 0; i < this.capacity; i += 1) this.buf[i] = values[i] ?? 0;
    this.start = 0;
    this.size = this.capacity;
  }

  at(i: number): number {
    return this.buf[(this.start + i) % this.capacity] ?? 0;
  }

  clear(): void {
    this.start = 0;
    this.size = 0;
  }
}

/** The plot's vertical window: centred on `center`, `half` either side, inside `[top, bottom]` CSS px. */
export interface YWindow {
  center: number;
  half: number;
  top: number;
  bottom: number;
}

export const yOf = (price: number, w: YWindow): number => {
  const mid = (w.top + w.bottom) / 2;
  return mid - ((price - w.center) / w.half) * ((w.bottom - w.top) / 2);
};

/** Uniform Catmull-Rom → cubic Bézier control points for segment i→i+1, `[c1x, c1y, c2x, c2y]`. */
export function catmullRom(xs: Float64Array, ys: Float64Array, i: number, n: number): [number, number, number, number] {
  const a = Math.max(0, i - 1);
  const d = Math.min(n - 1, i + 2);
  const b = i;
  const c = i + 1;
  const x = (k: number) => xs[k] ?? 0;
  const y = (k: number) => ys[k] ?? 0;
  return [
    x(b) + (x(c) - x(a)) / CATMULL,
    y(b) + (y(c) - y(a)) / CATMULL,
    x(c) - (x(d) - x(b)) / CATMULL,
    y(c) - (y(d) - y(b)) / CATMULL,
  ];
}

/** Grid ticks: a minor every step/5, a major every step, across `[lo, hi]`; empty past 400 ticks. */
export function gridTicks(lo: number, hi: number, step: number): { value: number; major: boolean }[] {
  const minor = step / MINOR_PER_MAJOR;
  if (!(minor > 0) || (hi - lo) / minor > MAX_TICKS) return [];
  const out: { value: number; major: boolean }[] = [];
  for (let k = Math.ceil(lo / minor); k * minor <= hi + EPSILON * Math.abs(hi); k++)
    out.push({ value: Number((k * minor).toFixed(TICK_DECIMALS)), major: k % MINOR_PER_MAJOR === 0 });
  return out;
}

/** A rolling digit's new target: forward on a rise, backward on a fall, by the mod-10 distance. */
export function rollTarget(cur: number, digitNow: number, digitNext: number, direction: 1 | -1 | 0): number {
  const fwd = (digitNext - digitNow + DIGITS) % DIGITS;
  const back = fwd === 0 ? 0 : fwd - DIGITS;
  const delta = direction > 0 ? fwd : direction < 0 ? back : Math.abs(back) < fwd ? back : fwd;
  return cur + delta;
}

/** The digit at a fractional roll position, the next one, and how far between them (0..1). */
export function rollFrame(cur: number): { digit: number; next: number; frac: number } {
  const base = Math.floor(cur);
  return {
    digit: ((base % DIGITS) + DIGITS) % DIGITS,
    next: (((base + 1) % DIGITS) + DIGITS) % DIGITS,
    frac: cur - base,
  };
}

/** Alpha for a label near a plot edge or the pill: fades over 14 px. */
export const edgeAlpha = (distancePx: number): number => Math.min(1, Math.max(0, distancePx / EDGE_FADE_PX));
