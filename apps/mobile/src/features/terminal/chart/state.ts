/**
 * The chart's per-frame state, as plain data the UI thread mutates (worklets carry no classes): the 600-sample ring of
 * eased prices, the rolling-digit slots of the pill (Owarine `canvas-odometer.ts`), and the parallax dot field's drift
 * (`dot-grid.ts`). `advance` runs once per display frame inside `useFrameCallback`; nothing here touches React.
 */
import { emptyOdometer, type Odometer, stepOdometer } from "~/components/kit/odometer";
import { BASE_TAU_MS, type ChartHistory, HISTORY_PAD, MAX_TICK_GAP_MS, TICK_EMA, TICK_FOLLOW } from "./constants";
import { niceStep, SAMPLE_CAPACITY, SAMPLE_MS, SPAN_STEPS, stepFor } from "./engine";

/** At most this many samples catch up in one frame (a stalled frame never smears the line). */
const MAX_SAMPLES_PER_FRAME = 8;
const MAX_FRAME_MS = 250;
const SETTLE_FRACTION = 1e-7;
/** Dot field (Tradash `DotGrid`): 34 px spacing, half the line's scroll, drift by price velocity in grid steps. */
export const DOT_SPACING = 34;
const DRIFT_GAIN = 4;
const DRIFT_CLAMP = 6;
const DRIFT_EASE = 0.06;
const DRIFT_WRAP = 1000;
const DOT_SCROLL = 0.5;

export interface ChartState {
  ready: boolean;
  ring: number[];
  start: number;
  size: number;
  target: number;
  latest: number;
  eased: number;
  step: number;
  sampleDebt: number;
  lastFrame: number;
  /** The last tick taken from `incoming` (its sequence number). */
  seenSeq: number;
  /** When the last tick arrived (frame clock), and the average interval between ticks. */
  lastTickAt: number;
  tickMs: number;
  velocitySteps: number;
  price: Odometer;
  pnl: Odometer;
  dotX: number;
  dotY: number;
  dotTargetY: number;
  /** A closed market's session (0: none): drawn whole and still on its own scale. */
  historySeq: number;
  historyCenter: number;
  historyHalf: number;
}

export function createChartState(): ChartState {
  return {
    ready: false,
    ring: new Array<number>(SAMPLE_CAPACITY).fill(0),
    start: 0,
    size: 0,
    target: 0,
    latest: 0,
    eased: 0,
    step: 0,
    sampleDebt: 0,
    lastFrame: 0,
    seenSeq: 0,
    lastTickAt: 0,
    tickMs: 0,
    velocitySteps: 0,
    price: emptyOdometer(),
    pnl: emptyOdometer(),
    dotX: 0,
    dotY: 0,
    dotTargetY: 0,
    historySeq: 0,
    historyCenter: 0,
    historyHalf: 0,
  };
}

/** A closed market's last session: loaded whole, scaled to its low and high, the pill on its close. */
export function loadHistory(s: ChartState, h: ChartHistory): void {
  "worklet";
  const range = h.high - h.low;
  for (let i = 0; i < SAMPLE_CAPACITY; i += 1) s.ring[i] = h.line[i] ?? h.close;
  s.start = 0;
  s.size = SAMPLE_CAPACITY;
  s.ready = true;
  s.target = h.close;
  s.latest = h.close;
  s.eased = h.close;
  s.step = range > 0 ? niceStep(range / SPAN_STEPS) : stepFor(h.close);
  s.historySeq = h.seq;
  s.historyCenter = (h.low + h.high) / 2;
  s.historyHalf = Math.max((range / 2) * HISTORY_PAD, s.step * 2);
}

export function ringAt(s: ChartState, i: number): number {
  "worklet";
  return s.ring[(s.start + i) % SAMPLE_CAPACITY] ?? 0;
}

function ringPush(s: ChartState, v: number): void {
  "worklet";
  if (s.size < SAMPLE_CAPACITY) {
    s.ring[(s.start + s.size) % SAMPLE_CAPACITY] = v;
    s.size += 1;
  } else {
    s.ring[s.start] = v;
    s.start = (s.start + 1) % SAMPLE_CAPACITY;
  }
}

/**
 * A tick at frame time `nowMs`. The first one seeds the line: from `line` (the last ~10 s of real history, `fillLine`,
 * 04-pricing R15) when there is one, else flat at the price (the chart grows movement from the right).
 */
export function takePrice(s: ChartState, price: number, nowMs: number, line: readonly number[] | null): void {
  "worklet";
  // A closed market's frozen frames don't move its session chart.
  if (s.historySeq !== 0 || !(price > 0) || !Number.isFinite(price)) return;
  const gap = s.lastTickAt === 0 ? 0 : nowMs - s.lastTickAt;
  if (gap > 0 && gap < MAX_TICK_GAP_MS) s.tickMs = s.tickMs === 0 ? gap : s.tickMs + TICK_EMA * (gap - s.tickMs);
  s.lastTickAt = nowMs;
  s.latest = price;
  if (!s.ready) {
    s.ready = true;
    s.target = price;
    s.eased = price;
    s.step = stepFor(price);
    const seeded = line !== null && line.length === SAMPLE_CAPACITY;
    for (let i = 0; i < SAMPLE_CAPACITY; i += 1) s.ring[i] = seeded ? (line[i] ?? price) : price;
    s.start = 0;
    s.size = SAMPLE_CAPACITY;
    return;
  }
  s.target = price;
}

/** A new market: forget the line, the scale and the digits. */
export function resetChart(s: ChartState): void {
  "worklet";
  s.ready = false;
  s.historySeq = 0;
  s.start = 0;
  s.size = 0;
  s.step = 0;
  s.price = emptyOdometer();
  s.pnl = emptyOdometer();
}

/**
 * One display frame: ease and sample on the fixed 60 Hz clock, roll the digits, and move the dots — left at half the
 * line's speed per sample pushed (so a 120 Hz screen doesn't double it), and up or down with the price's velocity.
 */
export function advance(s: ChartState, nowMs: number, reduced: boolean, plotW: number, live: boolean): void {
  "worklet";
  const dt = s.lastFrame === 0 ? SAMPLE_MS : Math.min(MAX_FRAME_MS, nowMs - s.lastFrame);
  s.lastFrame = nowMs;
  if (!s.ready) return;
  const before = s.eased;
  // A price that isn't live never scrolls as if it were: the line holds still (04-pricing R7).
  s.sampleDebt = live && s.historySeq === 0 ? s.sampleDebt + dt / SAMPLE_MS : 0;
  let pushes = Math.min(MAX_SAMPLES_PER_FRAME, Math.floor(s.sampleDebt));
  const pushed = pushes;
  s.sampleDebt -= Math.floor(s.sampleDebt);
  const tau = Math.max(BASE_TAU_MS, TICK_FOLLOW * s.tickMs);
  const k = reduced ? 1 : 1 - Math.exp(-SAMPLE_MS / tau);
  while (pushes > 0) {
    const d = s.target - s.eased;
    s.eased = Math.abs(d) < SETTLE_FRACTION * Math.abs(s.eased) ? s.target : s.eased + d * k;
    ringPush(s, s.eased);
    pushes -= 1;
  }
  stepOdometer(s.price, dt);
  stepOdometer(s.pnl, dt);
  s.velocitySteps = s.step > 0 ? (s.eased - before) / s.step : 0;
  if (reduced) return;
  s.dotX = (s.dotX - (DOT_SCROLL * pushed * plotW) / (SAMPLE_CAPACITY - 1)) % DOT_SPACING;
  s.dotTargetY += Math.max(-DRIFT_CLAMP, Math.min(DRIFT_CLAMP, DRIFT_GAIN * s.velocitySteps * DOT_SPACING));
  s.dotTargetY %= DOT_SPACING * DRIFT_WRAP;
  s.dotY += (s.dotTargetY - s.dotY) * DRIFT_EASE;
}
