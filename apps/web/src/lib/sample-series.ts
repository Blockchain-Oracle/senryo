/**
 * PREVIEW SAMPLE DATA — deterministic, seeded series that feed the D2 charts until the real data wiring lands (S6–S8).
 * Nothing here is a price, balance or quote from any market. Same seed → same series on every render (no Math.random).
 * Generators are lifted out of the 21st components (ssychui Balance Chart / Candle Chart) so the components stay data-driven.
 * Floats are fine here: these are illustrative chart coordinates, never money.
 */

import type { EquityFrame } from "@/components/ui/balance-chart";
import type { Candle } from "@/components/ui/candle/scale";

const MULBERRY_INC = 0x6d2b79f5;
const UINT32_RANGE = 4294967296;

/** mulberry32 PRNG (as shipped in the 21st items). */
export function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + MULBERRY_INC) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
  };
}

const POINTS = 90;
const FRAME_SEED = 11;
const FRAME_SEED_STEP = 97;
const START_RATIO = 0.94;
const STEP_BIAS = 0.42;
const STEP_SCALE = 0.006;
const DRIFT_SCALE = 0.0008;
const DRIFT_UP = 0.35;
const DRIFT_DOWN = -0.12;
const PERCENT = 100;
const HOURS_PER_DAY = 24;

/** A random walk that ends exactly at `base` (and, if given, opens at `base / (1 + changePct%)`). */
export function walk(base: number, seed: number, drift = DRIFT_UP, changePct?: number): number[] {
  const rand = mulberry32(seed);
  const values: number[] = [];
  let v = base * START_RATIO;
  for (let i = 0; i < POINTS; i++) {
    v += (rand() - STEP_BIAS) * base * STEP_SCALE + drift * base * DRIFT_SCALE;
    values.push(v);
  }
  const end = values[POINTS - 1] ?? base;
  const k = end === 0 ? 1 : base / end;
  const pinned = values.map((x) => x * k);
  const first = pinned[0] ?? base;
  if (changePct === undefined || first === 0) return pinned;
  const ramp = base / (1 + changePct / PERCENT) / first;
  return pinned.map((x, i) => x * ramp ** (1 - i / (POINTS - 1)));
}

const FRAMES = [
  { id: "1H", ticks: ["12:10", "12:25", "12:40", "12:55"] },
  { id: "24H", ticks: ["06:00", "12:00", "18:00", "00:00", "06:00"] },
  { id: "1W", ticks: ["Mon", "Wed", "Fri", "Sun"] },
  { id: "1M", ticks: ["Sep 1", "Sep 10", "Sep 19", "Sep 28"] },
  { id: "1Y", ticks: ["Dec", "Mar", "Jun", "Sep"] },
  { id: "All", ticks: ["2023", "2024", "2025", "2026"] },
] as const;

/** Equity history for the Balance Chart's 1H…All pills (1W trends down so the red state is exercised). */
export function sampleEquityFrames(base: number): EquityFrame[] {
  return FRAMES.map((f, idx) => ({
    id: f.id,
    ticks: f.ticks,
    values: walk(base, FRAME_SEED + idx * FRAME_SEED_STEP, f.id === "1W" ? DRIFT_DOWN : DRIFT_UP),
    stamp: (i: number) => `${f.id} · ${String(Math.floor((i / POINTS) * HOURS_PER_DAY)).padStart(2, "0")}:00`,
  }));
}

/** 1 Aug 2026 00:00 UTC; one candle per 6 h. */
const CANDLE_START = 1_785_542_400_000;
const CANDLE_STEP_MS = 21_600_000;
const WICK = 0.0011;
const VOL_BODY = 0.4;
const VOL_NOISE = 14;
const LCG_MUL = 1103515245;
const LCG_ADD = 12345;
const LCG_MOD = 0x7fffffff;
const SEED_MIX = 2654435761;

/** Candles whose last close is `mid` — built from the same walk the equity chart uses (the 21st "pinned" mode). */
export function sampleCandles(mid: number, seed: number): Candle[] {
  const path = walk(mid, seed);
  let s = (seed * SEED_MIX) >>> 0;
  const rnd = () => {
    s = (s * LCG_MUL + LCG_ADD) & LCG_MOD;
    return s / LCG_MOD;
  };
  return path.map((c, i) => {
    const o = i === 0 ? c : (path[i - 1] ?? c);
    return {
      o,
      h: Math.max(o, c) * (1 + rnd() * WICK),
      l: Math.min(o, c) * (1 - rnd() * WICK),
      c,
      v: Math.abs(c - o) * VOL_BODY + rnd() * VOL_NOISE,
      t: CANDLE_START + i * CANDLE_STEP_MS,
    };
  });
}

const SPARK_POINTS = 24;
const SPARK_BASE = 100;
const SPARK_WAVE = 3;
const SPARK_WAVE_DIV = 2.3;
const SPARK_NOISE = 1.4;
const SPARK_NOISE_FREQ = 1.7;

/** 24-point sparkline (the preview's `s(seed, drift)`). */
export function sampleSpark(seed: number, drift: number): number[] {
  return Array.from(
    { length: SPARK_POINTS },
    (_, i) =>
      SPARK_BASE +
      Math.sin(i / SPARK_WAVE_DIV + seed) * SPARK_WAVE +
      i * drift +
      Math.cos(i * SPARK_NOISE_FREQ + seed) * SPARK_NOISE,
  );
}
