/**
 * One frame of the replay film (Q3, D-350): what to draw at film time `t`, in normalised chart space (x 0 → 1 left to
 * right, y 0 → 1 bottom to top) so each app scales it to its own frame. The head is pinned at 55 % across with history
 * behind it; the path, the head's price (the pill), the dashed rule, the levels in view, the moments already reached
 * (each fading in over 120 ms), the PnL at that moment and its tone. Past the run the frame holds on the last one.
 */
import { FILM_FPS, FILM_HEAD_AT, type Film, type FilmLevel, type FilmMoment, marketAt, sampleIndex } from "./film.ts";

const MS = 1_000;
const FADE_MS = 120;
/** At most this many path points are drawn (the exporter draws every frame; the path stays light). */
const MAX_POINTS = 240;
const Y_LABELS = 3;
/** Label steps land on 1, 2 or 5 × a power of ten. */
const NICE = { two: 2, five: 5 } as const;
const MID = 0.5;

export interface FramePoint {
  x: number;
  y: number;
}

export interface FilmFrame {
  /** The path up to the head, oldest first. */
  path: FramePoint[];
  head: FramePoint & { price: number };
  pnl: number;
  /** PnL over what went in, bps (null with nothing in). */
  roiBps: number | null;
  tone: "up" | "down";
  levels: (FilmLevel & { y: number })[];
  moments: (FilmMoment & { x: number; y: number; alpha: number })[];
  /** Price labels on the right, bottom to top. */
  labels: { y: number; price: number }[];
  /** 0 → 1 through the run; 1 through the hold. */
  progress: number;
  holding: boolean;
}

const BPS = 10_000;

function niceStep(span: number): number {
  const raw = span / Y_LABELS;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / pow;
  const step = unit >= NICE.five ? NICE.five : unit >= NICE.two ? NICE.two : 1;
  return step * pow;
}

export function frameAt(f: Film, t: number): FilmFrame {
  const runT = Math.min(t, f.runMs);
  const frameIdx = Math.min(f.lows.length - 1, Math.round((runT / MS) * FILM_FPS));
  const lo = f.lows[frameIdx] ?? 0;
  const hi = f.highs[frameIdx] ?? 1;
  const yOf = (p: number) => (hi > lo ? (p - lo) / (hi - lo) : MID);
  const now = marketAt(f, runT);
  // The window: the head at 55 % across, `windowMs` of history behind it.
  const left = now - f.windowMs;
  const xOf = (ms: number) => ((ms - left) / f.windowMs) * FILM_HEAD_AT;
  const filmTimeOf = (ms: number) => ((ms - f.fromMs) / Math.max(1, f.toMs - f.fromMs)) * f.runMs;
  const i = sampleIndex(f, now);
  const a = sampleIndex(f, left);
  const next = Math.min(f.times.length - 1, i + 1);
  // The head moves every frame between samples (Fomo's tip); the figures step with the samples.
  const t0 = f.times[i] ?? now;
  const t1 = f.times[next] ?? now;
  const k = t1 > t0 ? Math.min(1, Math.max(0, (now - t0) / (t1 - t0))) : 0;
  const headPrice = (f.prices[i] ?? 0) + ((f.prices[next] ?? 0) - (f.prices[i] ?? 0)) * k;
  const step = Math.max(1, Math.ceil((i - a + 1) / MAX_POINTS));
  const path: FramePoint[] = [];
  for (let j = a; j <= i; j += step) path.push({ x: xOf(f.times[j] ?? now), y: yOf(f.prices[j] ?? headPrice) });
  path.push({ x: FILM_HEAD_AT, y: yOf(headPrice) });
  const pnl = f.pnls[i] ?? 0;
  const cost = f.input.cost;
  const labelStep = niceStep(hi - lo);
  const labels: { y: number; price: number }[] = [];
  for (let p = Math.ceil(lo / labelStep) * labelStep; p <= hi; p += labelStep) labels.push({ y: yOf(p), price: p });
  return {
    path,
    head: { x: FILM_HEAD_AT, y: yOf(headPrice), price: headPrice },
    pnl,
    roiBps: cost > 0 ? Math.round((pnl / cost) * BPS) : null,
    tone: pnl >= 0 ? "up" : "down",
    levels: f.input.levels.map((l) => ({ ...l, y: yOf(l.price) })).filter((l) => l.y >= 0 && l.y <= 1),
    moments: f.input.moments
      .filter((m) => m.ms <= now)
      .map((m) => ({
        ...m,
        x: xOf(m.ms),
        y: yOf(m.price),
        alpha: Math.min(1, Math.max(0, (t - filmTimeOf(m.ms)) / FADE_MS)),
      })),
    labels,
    progress: f.runMs > 0 ? runT / f.runMs : 1,
    holding: t > f.runMs,
  };
}
