// 21st: ssychui/candle-chart (#22250) — https://21st.dev/@ssychui/components/candle-chart
// Split on install (> 400 lines): scale (types, geometry, formatters) · layers · volume · crosshair · index.

export interface Candle {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  /** epoch ms */
  t: number;
}

export const UP = "var(--chart-up)";
export const DOWN = "var(--chart-candle-down)";
export const GRID = "color-mix(in srgb, var(--foreground) 5%, transparent)";
export const AXIS_TEXT = "color-mix(in srgb, var(--foreground) 28%, transparent)";
export const CROSS = "color-mix(in srgb, var(--foreground) 18%, transparent)";
export const CROSS_H = "color-mix(in srgb, var(--foreground) 14%, transparent)";

/** viewBox when not in fill mode */
export const VB_W = 560;
export const VB_H = 300;
export const AXIS_W = 46;
export const VOL_H = 46;
export const GAP = 8;
export const MIN_FILL_W = 240;
export const MIN_FILL_H = 160;
export const MIN_VOL = 20;
export const MAX_VOL = 120;
export const VOL_KEY_STEP = 8;
export const MIN_VISIBLE = 12;
export const Y_SCALE_MIN = 0.4;
export const Y_SCALE_MAX = 1.6;
export const WHEEL_Y = 0.0016;
export const WHEEL_X = 0.12;
export const DRAG_Y_GAIN = 2.2;
export const BODY_RATIO = 0.58;
export const BAND_PAD = 1.06;
export const CEIL_PAD = 1.02;
export const THIRD = 3;
export const DATE_LABELS = 6;
export const AXIS_FONT = 8.5;
export const AXIS_INSET = 4;
export const AXIS_TOP_MIN = 9;
export const AXIS_BOTTOM_PAD = 2;
export const AXIS_BASELINE = 3;
export const TAG_H = 16;
export const TAG_HALF = 8;
export const PERCENT = 100;
export const HALF = 2;
export const DIM_CANDLE = 0.45;
export const DIM_VOL = 0.3;
export const VOL_OPACITY = 0.6;

export const TIMEFRAMES = ["1D", "5D", "1M", "6M", "1Y"] as const;
export type CandleTimeframe = (typeof TIMEFRAMES)[number];
/** candles visible per preset — wheel on the date axis scrubs between these */
export const TF_COUNT: Record<CandleTimeframe, number> = { "1D": 24, "5D": 40, "1M": 60, "6M": 80, "1Y": 96 };

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const fmtUsd = (v: number) =>
  `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtAxis = (v: number) => (v === 0 ? "$0" : `$${Math.round(v).toLocaleString("en-US")}`);
export const fmtDay = (t: number) =>
  new Date(t).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
export const fmtStamp = (t: number) =>
  `${new Date(t)
    .toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    })
    .replace(",", "")} UTC`;

export interface Scale {
  /** plot box in viewBox units */
  vw: number;
  vh: number;
  plotW: number;
  plotH: number;
  slot: number;
  bodyW: number;
  xMid: (i: number) => number;
  yPrice: (v: number) => number;
  ticks: number[];
}

/**
 * Price band around the visible candles (`banded`, the pinned 21st mode that agrees with a book mid) or a 0-based
 * ceiling. `yScale` is the wheel/drag zoom around the band centre.
 */
export function makeScale(
  view: readonly Candle[],
  box: { vw: number; vh: number },
  volH: number,
  yScale: number,
  banded: boolean,
  ceil: number,
): Scale {
  const plotW = box.vw - AXIS_W;
  const plotH = box.vh - volH - GAP;
  const slot = plotW / Math.max(1, view.length);
  const maxHigh = Math.max(...view.map((k) => k.h));
  const minLow = Math.min(...view.map((k) => k.l));
  const mid = (maxHigh + minLow) / HALF;
  const half = ((maxHigh - minLow) / HALF) * BAND_PAD * (banded ? yScale : 1);
  const top = banded ? mid + half : Math.max(ceil * yScale, maxHigh * CEIL_PAD);
  const floor = banded ? mid - half : 0;
  const yPrice = (v: number) => (1 - (v - floor) / (top - floor || 1)) * plotH;
  const ticks = banded
    ? [top, mid + half / THIRD, mid - half / THIRD, floor]
    : [top, (top * HALF) / THIRD, top / THIRD, 0];
  return {
    vw: box.vw,
    vh: box.vh,
    plotW,
    plotH,
    slot,
    bodyW: slot * BODY_RATIO,
    xMid: (i) => i * slot + slot / HALF,
    yPrice,
    ticks,
  };
}
