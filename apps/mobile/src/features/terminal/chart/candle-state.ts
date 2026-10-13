/**
 * The candle view's per-frame state on the phone (R5.17), plain data inside the chart's state: the series (`@senryo/calls`
 * `CandleData`), the view wanted (an interval, or the line), the crossfade, the scroll and zoom from the gestures, and
 * the crosshair. Worklets, run in the frame callback and the gesture handlers.
 */
import {
  type CandleData,
  candleCount,
  candleDecay,
  candleTick,
  defaultSpacing,
  SPACING_MAX,
  SPACING_MIN,
} from "@senryo/calls";

/** The crossfade between the line and the candles, Tradash's 200 ms. */
const CROSSFADE_MS = 200;
const RECENTRE = 0.2;
const RECENTRE_DONE = 0.01;
/** The fewest candles kept on screen when scrolled back, and how near the oldest older history is asked for. */
const KEEP_VISIBLE = 5;
const OLDER_WITHIN = 20;

export interface CandleView {
  data: CandleData | null;
  /** The interval wanted in ms; 0 for the line. */
  wantMs: number;
  mix: number;
  /** Candles scrolled back from the newest, and px per candle (0: fitted to the plot). */
  offset: number;
  spacing: number;
  /** The plot width the gestures measure against (the frame's estimate). */
  plotW: number;
  cross: { x: number; y: number } | null;
  recentring: boolean;
  /** The oldest candle start already asked for older history (so each is asked once). */
  olderAsked: number;
}

export function createCandleView(): CandleView {
  "worklet";
  return {
    data: null,
    wantMs: 0,
    mix: 0,
    offset: 0,
    spacing: 0,
    plotW: 0,
    cross: null,
    recentring: false,
    olderAsked: 0,
  };
}

export const spacingOf = (v: CandleView, plotW: number): number => {
  "worklet";
  return v.spacing > 0 ? v.spacing : defaultSpacing(plotW);
};

/** Each frame: the forming candle follows the price; the crossfade moves towards the view wanted. */
export function advanceCandles(
  v: CandleView,
  dtMs: number,
  reduced: boolean,
  raw: number,
  eased: number,
  wallMs: number,
  plotW: number,
): void {
  "worklet";
  v.plotW = plotW;
  const want = v.wantMs > 0 && v.data ? 1 : 0;
  const gap = want - v.mix;
  v.mix = reduced ? want : v.mix + Math.sign(gap) * Math.min(Math.abs(gap), dtMs / CROSSFADE_MS);
  if (v.mix === 0 && v.wantMs === 0) {
    v.data = null;
    v.cross = null;
  }
  if (!v.data || v.wantMs === 0) return;
  candleTick(v.data, raw, eased, wallMs);
  candleDecay(v.data);
  if (!v.recentring) return;
  v.offset *= 1 - RECENTRE;
  if (v.offset < RECENTRE_DONE) {
    v.offset = 0;
    v.recentring = false;
  }
}

/** A drag of `dx` px (right reaches back into history). Returns the oldest candle's start when older history is due. */
export function panCandles(v: CandleView, dx: number): number | null {
  "worklet";
  const d = v.data;
  if (!d) return null;
  const spacing = spacingOf(v, v.plotW);
  v.recentring = false;
  const count = candleCount(d);
  v.offset = Math.min(Math.max(0, count - KEEP_VISIBLE), Math.max(0, v.offset + dx / spacing));
  const oldest = d.closed[0]?.t;
  if (oldest === undefined || oldest === v.olderAsked) return null;
  if (v.offset + v.plotW / spacing <= count - OLDER_WITHIN) return null;
  v.olderAsked = oldest;
  return oldest;
}

export function zoomCandles(v: CandleView, factor: number): void {
  "worklet";
  v.spacing = Math.min(SPACING_MAX, Math.max(SPACING_MIN, spacingOf(v, v.plotW) * factor));
}

export function recentreCandles(v: CandleView): void {
  "worklet";
  v.recentring = true;
  v.spacing = 0;
}
