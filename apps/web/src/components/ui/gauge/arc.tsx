// 21st: designali-in/gauge-1 (#3719) — arc geometry. The source faked the half gauge with dasharray + CSS rotate, which
// drew a lopsided ¾ arc; here every arc is a real SVG path between two angles, so `half` is a true semicircle.

export type GaugeType = "full" | "half";

/** viewBox units */
export const BOX = 100;
export const CENTER = 50;
const HALF_BOX_H = 58;
const FULL_SWEEP = 360;
const HALF_SWEEP = 180;
const DEG = Math.PI / HALF_SWEEP;
const TOP = -90;
const LEFT = 180;
const LARGE_ARC = 180;
/** a 360° path is degenerate; stop just short */
const FULL_EPSILON = 0.01;
const PERCENT = 100;
const HALF = 2;

export interface Geometry {
  start: number;
  sweep: number;
  viewBox: string;
  /** height ÷ width of the rendered svg */
  ratio: number;
  /** y of the value text / label in viewBox units */
  valueY: number;
  labelY: number;
}

const HALF_VALUE_Y = 36;
const HALF_LABEL_Y = 52;
const FULL_LABEL_DY = 20;

export function geometry(type: GaugeType): Geometry {
  return type === "half"
    ? {
        start: LEFT,
        sweep: HALF_SWEEP,
        viewBox: `0 0 ${BOX} ${HALF_BOX_H}`,
        ratio: HALF_BOX_H / BOX,
        valueY: HALF_VALUE_Y,
        labelY: HALF_LABEL_Y,
      }
    : {
        start: TOP,
        sweep: FULL_SWEEP,
        viewBox: `0 0 ${BOX} ${BOX}`,
        ratio: 1,
        valueY: CENTER,
        labelY: CENTER + FULL_LABEL_DY,
      };
}

const point = (r: number, deg: number) => ({
  x: CENTER + r * Math.cos(deg * DEG),
  y: CENTER + r * Math.sin(deg * DEG),
});

/** Clockwise arc path from `a0` to `a1` degrees (0° = 3 o'clock). */
export function arcPath(r: number, a0: number, a1: number): string {
  const span = Math.min(a1 - a0, FULL_SWEEP - FULL_EPSILON);
  if (span <= 0) return "";
  const p0 = point(r, a0);
  const p1 = point(r, a0 + span);
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${span > LARGE_ARC ? 1 : 0} 1 ${p1.x} ${p1.y}`;
}

/** Split the track at `pct` (0–100) into the value arc and the remainder, with `gapPct` of the sweep between them. */
export function splitArcs(geo: Geometry, r: number, pct: number, gapPct: number, full: boolean) {
  const gap = (gapPct / PERCENT) * geo.sweep;
  const edge = full ? gap / HALF : 0;
  const at = geo.start + (pct / PERCENT) * geo.sweep;
  const end = geo.start + geo.sweep;
  return {
    primary: arcPath(r, geo.start + edge, Math.min(at - gap / HALF, end - edge)),
    secondary: arcPath(r, Math.max(at + gap / HALF, geo.start + edge), end - edge),
  };
}

/** Marker position for a threshold at `pct` of the sweep, `offset` outside radius `r`. */
export function markerAt(geo: Geometry, r: number, pct: number) {
  return point(r, geo.start + (pct / PERCENT) * geo.sweep);
}

export function Arc({ d, stroke, width }: { d: string; stroke: string; width: number }) {
  if (!d) return null;
  return <path d={d} fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" />;
}
