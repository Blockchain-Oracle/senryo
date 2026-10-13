/**
 * A replay's whole history (Q3, D-353): the path this device recorded, with every stretch it didn't — the app closed,
 * the phone asleep, another device — filled from Senryo's own 1-minute candles (`/v1/prices/candles`), so an
 * hour-long trade replays its whole hour of ups and downs rather than the few minutes that happened to be watched.
 * Each missing minute becomes its candle's open, its wick the way the minute went (low first on a rising candle, high
 * first on a falling one) and its close; a recorded sample always wins over a candle point beside it. A trade this
 * device never saw is rebuilt from candles alone. The result says whether anything was filled, so the film can say so.
 */
import type { ReplaySample } from "./replay.ts";

/** `[minute start (s), open, high, low, close]` in e-8, as the candles route returns them. */
export type FilmCandle = readonly [number, number, number, number, number];

const MS = 1_000;
const E8 = 1e8;
/** Where in its minute each candle point sits (ms): open, first wick, second wick, close. */
const POINT_AT_MS = { open: 0, firstWick: 15_000, secondWick: 35_000, close: 59_000 } as const;
const POINT_OFFSETS = Object.values(POINT_AT_MS);
/** A candle point is used only where no recorded sample is this close: the recording covers it. */
const COVERED_MS = 45_000;

export interface FilledHistory {
  samples: ReplaySample[];
  /** Candle points were added (the film says "Gaps from 1-minute prices", or "Rebuilt…" when nothing was recorded). */
  filled: boolean;
  /** No recorded sample at all: the path is candles only. */
  rebuilt: boolean;
}

function candlePoints(c: FilmCandle): [number, number][] {
  const [minute, open, high, low, close] = c;
  const rising = close >= open;
  const wicks = rising ? [low, high] : [high, low];
  const prices = [open, wicks[0] ?? open, wicks[1] ?? close, close];
  return POINT_OFFSETS.map((offset, i) => [minute * MS + offset, (prices[i] ?? close) / E8]);
}

/** Recorded samples first; candle points only in the gaps, within `fromMs`…`toMs`; `pnlAt` values a filled price. */
export function fillHistory(
  recorded: readonly ReplaySample[],
  candles: readonly FilmCandle[],
  fromMs: number,
  toMs: number,
  pnlAt: (price: number) => string | null,
): FilledHistory {
  const own = recorded.filter((s) => Number.isFinite(s[1]));
  const times = own.map((s) => s[0]);
  // Times are ascending: a binary search finds the nearest recorded sample to a candle point.
  const nearest = (ms: number) => {
    let lo = 0;
    let hi = times.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((times[mid] ?? 0) < ms) lo = mid + 1;
      else hi = mid;
    }
    const a = times[lo] ?? Number.POSITIVE_INFINITY;
    const b = times[lo - 1] ?? Number.NEGATIVE_INFINITY;
    return Math.min(Math.abs(a - ms), Math.abs(ms - b));
  };
  const added: ReplaySample[] = [];
  for (const c of candles) {
    for (const [ms, price] of candlePoints(c)) {
      if (ms < fromMs || ms > toMs || !Number.isFinite(price) || price <= 0) continue;
      if (own.length > 0 && nearest(ms) < COVERED_MS) continue;
      added.push([ms, price, pnlAt(price)]);
    }
  }
  const samples = [...own, ...added].sort((a, b) => a[0] - b[0]);
  return { samples, filled: added.length > 0, rebuilt: own.length === 0 && added.length > 0 };
}
