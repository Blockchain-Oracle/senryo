/**
 * The candle view on the phone's chart (R5.17; the web's `candle-draw.ts`, Skia): the visible candles as two batched
 * paths per tone (wicks, bodies) under the crossfade, the newest sliding in after each rollover, the y-window fitted
 * to the visible bodies, and the crosshair — snapped to a candle and to step / 5 detents — with its O / H / L / C
 * read-out in the plot's top-right corner. Worklets: everything here runs on the UI thread.
 */
import {
  bodyWidth,
  type Candle,
  type CandleData,
  candleAt,
  candleStep,
  detent,
  slotX,
  visibleRange,
} from "@senryo/calls";
import { type SkCanvas, Skia } from "@shopify/react-native-skia";
import { formatValue, niceStep, priceDecimals, SPAN_STEPS, type YWindow, yOf } from "./engine";
import { type DrawKit, fill, stroke, textRight } from "./kit";

const HALF = 2;
const WICK = 1;
const CROSS_ALPHA = 0.7;
const READOUT = { pad: 6, line: 14, width: 118, alpha: 0.92 } as const;

export interface CandleLayout {
  plotW: number;
  spacing: number;
  offset: number;
}

/** The candles' y-window around the price and its grid step. */
export function candleWindow(
  d: CandleData,
  l: CandleLayout,
  price: number,
  top: number,
  bottom: number,
): { win: YWindow; step: number } {
  "worklet";
  const { from, to } = visibleRange(l.plotW, l.spacing, l.offset);
  const bodies: Candle[] = [];
  for (let k = from; k <= to; k++) {
    const c = candleAt(d, k);
    if (c) bodies.push(c);
  }
  const step = candleStep(bodies, price, niceStep);
  return { win: { center: price, half: (SPAN_STEPS * step) / HALF, top, bottom }, step };
}

export function drawCandles(
  c: SkCanvas,
  k: DrawKit,
  d: CandleData,
  l: CandleLayout,
  win: YWindow,
  alpha: number,
): void {
  "worklet";
  const { from, to } = visibleRange(l.plotW, l.spacing, l.offset);
  const body = bodyWidth(l.spacing);
  c.save();
  c.clipRect(Skia.XYWHRect(0, 0, l.plotW + l.spacing / HALF, win.bottom + win.top), 1, true);
  for (const rising of [true, false]) {
    let wicks = "";
    let bodies = "";
    for (let i = from; i <= to; i++) {
      const can = candleAt(d, i);
      if (!can || can.c >= can.o !== rising) continue;
      const x = slotX(i, l.plotW, l.spacing, l.offset, d.slide);
      const wx = Math.round(x) + WICK / HALF;
      wicks += `M${wx} ${yOf(can.h, win)}L${wx} ${yOf(can.l, win)}`;
      const y1 = Math.round(yOf(Math.max(can.o, can.c), win));
      const hgt = Math.max(1, Math.round(yOf(Math.min(can.o, can.c), win)) - y1);
      bodies += `M${Math.round(x - body / HALF)} ${y1}h${body}v${hgt}h${-body}Z`;
    }
    const tone = rising ? k.colors.up : k.colors.down;
    const w = wicks ? Skia.Path.MakeFromSVGString(wicks) : null;
    if (w) c.drawPath(w, stroke(k, tone, WICK, alpha));
    const b = bodies ? Skia.Path.MakeFromSVGString(bodies) : null;
    if (b) c.drawPath(b, fill(k, tone, alpha));
  }
  c.restore();
}

/** The crosshair at `at`: the lines and the candle's read-out; its detent key (null off a candle). */
export function drawCrosshair(
  c: SkCanvas,
  k: DrawKit,
  d: CandleData,
  l: CandleLayout,
  win: YWindow,
  step: number,
  at: { x: number; y: number },
): string | null {
  "worklet";
  const mid = (win.top + win.bottom) / HALF;
  const price = win.center + ((mid - at.y) / ((win.bottom - win.top) / HALF)) * win.half;
  const snap = detent(at.x, price, { plotW: l.plotW, spacing: l.spacing, offset: l.offset, slide: d.slide }, step);
  const can = candleAt(d, snap.k);
  if (!can) return null;
  const x = slotX(snap.k, l.plotW, l.spacing, l.offset, d.slide);
  const y = yOf(snap.price, win);
  const line = stroke(k, k.colors.helper, 1, CROSS_ALPHA);
  c.drawLine(x, win.top, x, win.bottom, line);
  c.drawLine(0, y, l.plotW, y, line);
  const decimals = priceDecimals(can.c);
  const rows = [
    `O ${formatValue(can.o, decimals, k.points)}`,
    `H ${formatValue(can.h, decimals, k.points)}`,
    `L ${formatValue(can.l, decimals, k.points)}`,
    `C ${formatValue(can.c, decimals, k.points)}`,
  ];
  const left = l.plotW - READOUT.width - READOUT.pad;
  const h = rows.length * READOUT.line + READOUT.pad;
  c.drawRect(Skia.XYWHRect(left, win.top, READOUT.width, h), fill(k, k.colors.inverse, READOUT.alpha));
  rows.forEach((row, i) => {
    textRight(
      c,
      k,
      row,
      left + READOUT.width - READOUT.pad,
      win.top + READOUT.pad / HALF + READOUT.line * (i + 1 / HALF),
      k.fonts.tag,
      k.mids.tag,
      k.colors.ink,
      1,
    );
  });
  return `${snap.k}:${snap.price}`;
}
