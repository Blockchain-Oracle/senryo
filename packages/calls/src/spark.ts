/**
 * Every price's 24-hour graph (D-319, F7; Mitoshi's 21st #30538 sparkline made passive): the closes `/v1/prices/day`
 * serves (`SPARK_POINTS` steps of `SPARK_STEP_SEC`, null where the archive has no candle) with the live price as the
 * last point, drawn as one path that breaks at gaps — never bridged, never invented — against a dashed baseline at the
 * price 24 hours ago. Green above it, coral below, grey level. Both apps draw this geometry: an SVG path on the web,
 * a Skia path on the phone (`Skia.Path.MakeFromSVGString`).
 */
import { SPARK_POINTS } from "@senryo/config";

export type DayTone = "up" | "down" | "flat";

export interface DayLine {
  /** The price 24 hours ago (e-8): the baseline and the change's base. */
  openE8: number;
  /** The closes since, oldest first (e-8; null = no candle in that step). */
  spark: readonly (number | null)[];
}

export interface DayChange {
  tone: DayTone;
  /** "↑ +2.34%" (a true minus for a fall; "0.00%" level). */
  text: string;
}

const PERCENT = 100;
const PCT_DECIMALS = 2;
/** A move under half a basis point reads as level (grey), not a colour that flickers on noise. */
const FLAT_FRACTION = 0.00005;

export function dayTone(openE8: number, nowE8: number): DayTone {
  if (openE8 <= 0) return "flat";
  const move = (nowE8 - openE8) / openE8;
  return Math.abs(move) < FLAT_FRACTION ? "flat" : move > 0 ? "up" : "down";
}

/** The 24 h change against the price 24 hours ago. */
export function dayChange(openE8: number, nowE8: number): DayChange {
  const tone = dayTone(openE8, nowE8);
  const pct = openE8 > 0 ? ((nowE8 - openE8) / openE8) * PERCENT : 0;
  const body = Math.abs(pct).toFixed(PCT_DECIMALS);
  const text = tone === "up" ? `↑ +${body}%` : tone === "down" ? `↓ −${body}%` : `${body}%`;
  return { tone, text };
}

export interface SparkGeometry {
  /** The line as an SVG path in a `width × height` box; `M` restarts after a gap. */
  d: string;
  /** The same line closed down to the box's floor, for the faint fill under it. */
  area: string;
  /** The baseline's y (the price 24 hours ago). */
  baseY: number;
  tone: DayTone;
}

export interface SeriesGeometry {
  /** The line as an SVG path; `M` restarts after a gap (a null). */
  d: string;
  /** The same line closed down to the box's floor, for the faint fill under it. */
  area: string;
  /** Where index `i` sits across, and where value `v` sits down, in the box. */
  x: (i: number) => number;
  y: (v: number) => number;
  lo: number;
  hi: number;
}

/**
 * Any series as a line in a `width × height` box with `pad` kept clear top and bottom (P5 generalised D-319's day
 * line): the points spread evenly across the width, gaps (null) break the path, `include` widens the range (a
 * baseline). Null with fewer than two known points.
 */
export function seriesGeometry(
  values: readonly (number | null)[],
  width: number,
  height: number,
  pad: number,
  include: readonly number[] = [],
): SeriesGeometry | null {
  const known = values.filter((v): v is number => v !== null);
  if (known.length < 2) return null;
  const lo = Math.min(...known, ...include);
  const hi = Math.max(...known, ...include);
  const span = hi - lo || 1;
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * width;
  const y = (v: number) => pad + (1 - (v - lo) / span) * (height - pad * 2);
  let d = "";
  let area = "";
  let run: { x: number; y: number }[] = [];
  const flush = () => {
    const first = run[0];
    const last = run[run.length - 1];
    if (!first || !last) return;
    const line = run.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
    d += `${d ? " " : ""}${line}`;
    area += `${area ? " " : ""}${line} L${last.x.toFixed(2)},${height} L${first.x.toFixed(2)},${height} Z`;
    run = [];
  };
  values.forEach((v, i) => {
    if (v === null) flush();
    else run.push({ x: x(i), y: y(v) });
  });
  flush();
  return { d, area, x, y, lo, hi };
}

/**
 * The geometry of a day line in a `width × height` box with `pad` kept clear top and bottom: the steps spread evenly
 * across the width and the live price (when known) closes it at the right edge. Null with fewer than two points.
 */
export function sparkGeometry(
  day: DayLine,
  nowE8: number | undefined,
  width: number,
  height: number,
  pad: number,
): SparkGeometry | null {
  const values: (number | null)[] = [...day.spark.slice(0, SPARK_POINTS)];
  while (values.length < SPARK_POINTS) values.push(null);
  values.push(nowE8 ?? null);
  const g = seriesGeometry(values, width, height, pad, [day.openE8]);
  if (!g) return null;
  const known = values.filter((v): v is number => v !== null);
  const latest = known[known.length - 1] ?? day.openE8;
  return { d: g.d, area: g.area, baseY: g.y(day.openE8), tone: dayTone(day.openE8, latest) };
}
