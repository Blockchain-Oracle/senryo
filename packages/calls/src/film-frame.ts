/**
 * One frame of the replay film (Q3, D-350; Codex direction 17 §2–3): what to draw at film time `t`, in normalised plot
 * space (x 0 → 1 left to right, y 0 → 1 bottom to top) so each app scales it to its own frame. The head is pinned 70 %
 * across with history behind it and nothing replayed to its right; the path, the head's price, the levels (one beyond
 * the range isn't drawn), the moments reached as discs on the line with Fomo's tooltip (IN's for 1.4 s, OUT's to the
 * end), the PnL stepping at most every 100 ms and landing on the realised result, its tone (neutral before IN or when
 * unknown), at most three price labels and up to three time ticks. Past the run the frame holds.
 */
import {
  FILM_FPS,
  FILM_HEAD_AT,
  FILM_LAND_MS,
  FILM_LEAD_MS,
  type Film,
  type FilmLevel,
  type FilmMoment,
  type FilmProvenance,
  filmTimeAt,
  marketAt,
  sampleIndex,
  windowAt,
} from "./film.ts";

const MS = 1_000;
const FADE_MS = 120;
/** A tooltip fades in over 80 ms; IN's leaves after 1.4 s (Fomo's buy), OUT's stays. */
const TIP_IN_MS = 80;
const IN_TIP_MS = 1_400;
/** The figures take a new value at most this often (film time). */
const NUMBER_STEP_MS = 100;
const MAX_POINTS = 240;
const Y_LABELS = 3;
const TIME_TICKS = 3;
const NICE = { two: 2, five: 5, ten: 10 } as const;
const MID = 0.5;
const BPS = 10_000;
/** Time-tick steps (ms): the first giving at most three ticks across the visible history. */
const TICK_MS = {
  s5: 5_000,
  s10: 10_000,
  s15: 15_000,
  s30: 30_000,
  m1: 60_000,
  m2: 120_000,
  m5: 300_000,
  m10: 600_000,
  m15: 900_000,
  m30: 1_800_000,
  h1: 3_600_000,
} as const;
const TICK_STEPS_MS = Object.values(TICK_MS);

export interface FramePoint {
  x: number;
  y: number;
}

export interface FilmFrame {
  path: FramePoint[];
  head: FramePoint & { price: number };
  /** Null before the fill or when unknown. */
  pnl: number | null;
  roiBps: number | null;
  tone: "up" | "down" | "flat";
  levels: (FilmLevel & { y: number; edge: "top" | "bottom" | null })[];
  /** `alpha` is the disc's; `tipAlpha` the tooltip's. */
  moments: (FilmMoment & { x: number; y: number; alpha: number; tipAlpha: number })[];
  labels: { y: number; price: number }[];
  ticks: { x: number; ms: number }[];
  provenance: FilmProvenance;
  /** The film has reached its exit (OUT shown, the result landed). */
  ended: boolean;
  holding: boolean;
  progress: number;
}

function niceStep(span: number): number {
  const raw = span / Y_LABELS;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / pow;
  // Rounded up, so a range never carries more than three labels.
  const step = unit > NICE.five ? NICE.ten : unit > NICE.two ? NICE.five : unit > 1 ? NICE.two : 1;
  return step * pow;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function frameAt(f: Film, t: number): FilmFrame {
  const runT = Math.min(Math.max(0, t), f.runMs);
  const frameIdx = Math.min(f.lows.length - 1, Math.round((runT / MS) * FILM_FPS));
  const lo = f.lows[frameIdx] ?? 0;
  const hi = f.highs[frameIdx] ?? 1;
  const yOf = (p: number) => (hi > lo ? (p - lo) / (hi - lo) : MID);
  const now = marketAt(f, runT);
  const span = windowAt(f, now);
  const left = now - span;
  const xOf = (ms: number) => ((ms - left) / span) * FILM_HEAD_AT;
  const i = sampleIndex(f, now);
  const next = Math.min(f.times.length - 1, i + 1);
  const t0 = f.times[i] ?? now;
  const t1 = f.times[next] ?? now;
  const k = t1 > t0 ? clamp01((now - t0) / (t1 - t0)) : 0;
  const headPrice = (f.prices[i] ?? 0) + ((f.prices[next] ?? 0) - (f.prices[i] ?? 0)) * k;
  const a = sampleIndex(f, left);
  // A long history thins to its buckets' lows and highs in time order, so every up and down survives the squeeze.
  const step = Math.max(1, Math.ceil((i - a + 1) / MAX_POINTS));
  const path: FramePoint[] = [];
  const at = (j: number) => ({ x: xOf(f.times[j] ?? now), y: yOf(f.prices[j] ?? headPrice) });
  for (let j = a; j <= i; j += step) {
    if (step === 1) {
      path.push(at(j));
      continue;
    }
    let lo = j;
    let hi = j;
    for (let k = j; k < Math.min(i + 1, j + step); k++) {
      if ((f.prices[k] ?? 0) < (f.prices[lo] ?? 0)) lo = k;
      if ((f.prices[k] ?? 0) > (f.prices[hi] ?? 0)) hi = k;
    }
    for (const k of lo <= hi ? [lo, hi] : [hi, lo]) path.push(at(k));
  }
  path.push({ x: FILM_HEAD_AT, y: yOf(headPrice) });

  // The figures step at most every 100 ms; in the last 0.4 s of the run they land on the realised result.
  const landing = runT >= f.runMs - FILM_LAND_MS && f.input.exit !== null;
  const quantised = marketAt(f, Math.floor(runT / NUMBER_STEP_MS) * NUMBER_STEP_MS);
  const known = runT < FILM_LEAD_MS || quantised < f.fillMs ? null : (f.pnls[sampleIndex(f, quantised)] ?? null);
  const pnl = landing && f.input.realised !== null ? f.input.realised : known;
  const cost = f.input.cost;

  const labels: { y: number; price: number }[] = [];
  const labelStep = niceStep(hi - lo);
  for (let p = Math.ceil(lo / labelStep) * labelStep; p <= hi; p += labelStep) labels.push({ y: yOf(p), price: p });
  const tickStep = TICK_STEPS_MS.find((s) => span / s <= TIME_TICKS) ?? TICK_STEPS_MS.at(-1) ?? MS;
  const ticks: { x: number; ms: number }[] = [];
  for (let ms = Math.ceil(left / tickStep) * tickStep; ms <= now; ms += tickStep) ticks.push({ x: xOf(ms), ms });

  return {
    path,
    head: { x: FILM_HEAD_AT, y: yOf(headPrice), price: headPrice },
    pnl,
    roiBps: pnl === null || cost === null || cost <= 0 ? null : Math.round((pnl / cost) * BPS),
    tone: pnl === null || pnl === 0 ? "flat" : pnl > 0 ? "up" : "down",
    levels: f.input.levels.map((l) => {
      const y = yOf(l.price);
      return { ...l, y: clamp01(y), edge: y > 1 ? ("top" as const) : y < 0 ? ("bottom" as const) : null };
    }),
    moments: f.input.moments
      .map((m) => ({ m, at: filmTimeAt(f, m.ms) }))
      .filter(({ at }) => at <= t)
      .map(({ m, at }) => ({
        ...m,
        x: xOf(m.ms),
        y: yOf(m.price),
        alpha: clamp01((t - at) / FADE_MS),
        tipAlpha: Math.min(
          clamp01((t - at) / TIP_IN_MS),
          m.kind === "out" ? 1 : clamp01((at + IN_TIP_MS - t) / FADE_MS),
        ),
      })),
    labels,
    ticks,
    provenance: f.input.provenance,
    ended: landing,
    holding: t > f.runMs,
    progress: f.runMs > 0 ? runT / f.runMs : 1,
  };
}
