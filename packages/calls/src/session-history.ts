/**
 * A closed market's chart (the owner, 10 Oct: "a closed market doesn't mean we can't see the chart"): its last
 * session from Senryo's own 1-minute candles (`/v1/prices/candles`, the settlement prices), spread across the chart's
 * samples, with the session's low and high for the scale and its close for the pill. Both apps draw it.
 */
import { priceFromE8 } from "@senryo/core";
import { fillLine } from "@senryo/live";

/** `[minute start (s), open, high, low, close]` in e-8. */
export type Candle = readonly [number, number, number, number, number];

export interface SessionHistory {
  /** `capacity` values, oldest first, across the session. */
  line: number[];
  low: number;
  high: number;
  close: number;
  fromSec: number;
  toSec: number;
}

const MINUTE_SEC = 60;
const SESSION_GAP_MINUTES = 15;
/** A gap longer than this between candles ends a session (an overnight or weekend close). */
const SESSION_GAP_SEC = SESSION_GAP_MINUTES * MINUTE_SEC;
const MS = 1000;
const OPEN = 1;
const HIGH = 2;
const LOW = 3;
const CLOSE = 4;

/** The last session's line, or null with fewer than two candles in it. */
export function sessionHistory(candles: readonly Candle[], capacity: number): SessionHistory | null {
  if (candles.length < 2) return null;
  let start = candles.length - 1;
  while (start > 0 && (candles[start]?.[0] ?? 0) - (candles[start - 1]?.[0] ?? 0) <= SESSION_GAP_SEC) start -= 1;
  const session = candles.slice(start);
  if (session.length < 2) return null;
  // The open of the first minute, then each minute's close at its end: the path the price took.
  const first = session[0] as Candle;
  const times = [first[0] * MS, ...session.map((c) => (c[0] + MINUTE_SEC) * MS)];
  const values = [first[OPEN], ...session.map((c) => c[CLOSE])];
  const fromMs = times[0] ?? 0;
  const toMs = times[times.length - 1] ?? 0;
  const line = fillLine(times, values, toMs, capacity, (toMs - fromMs) / (capacity - 1));
  if (!line) return null;
  return {
    line: line.map(priceFromE8),
    low: priceFromE8(Math.min(...session.map((c) => c[LOW]))),
    high: priceFromE8(Math.max(...session.map((c) => c[HIGH]))),
    close: priceFromE8((session[session.length - 1] as Candle)[CLOSE]),
    fromSec: first[0],
    toSec: toMs / MS,
  };
}
