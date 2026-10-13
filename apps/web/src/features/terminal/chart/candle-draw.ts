/**
 * The candle view on the web chart (R5.17; Owarine's `candle-view.ts` drawing, Tradash's `CandleViewport`): the
 * visible candles in two batched paths per tone (wicks, then bodies), the newest sliding in from the right after each
 * rollover, the y-window fitted to the visible bodies (`candleStep`), and the crosshair — snapped to a candle and to
 * step / 5 detents — with its open / high / low / close read-out. Pure drawing; the series lives in `@senryo/calls`.
 */
import {
  bodyWidth,
  type Candle,
  type CandleSeries,
  candleStep,
  detent,
  SPACING_MAX,
  SPACING_MIN,
  slotX,
  visibleRange,
} from "@senryo/calls";
import { formatPrice, type PriceUnit } from "@senryo/core";
import type { ChartTheme } from "./draw";
import { niceStep, type YWindow, yOf } from "./engine";

const SPAN_STEPS = 15;
const HALF = 2;
const WICK = 1;
const CROSS_DASH_ON = 3;
const CROSS_DASH = [CROSS_DASH_ON, CROSS_DASH_ON] as const;
const READOUT_PAD = 6;
const READOUT_LINE = 14;
const READOUT_ALPHA = 0.92;

export interface CandleLayout {
  plotW: number;
  spacing: number;
  /** Candles scrolled back from the newest (0: the forming one at the edge). */
  offset: number;
}

/** The candle view's y-window: centred on the price, sized by the visible bodies. */
export function candleWindow(
  series: CandleSeries,
  l: CandleLayout,
  price: number,
  top: number,
  bottom: number,
): { win: YWindow; step: number } {
  const { from, to } = visibleRange(l.plotW, l.spacing, l.offset);
  const bodies: Candle[] = [];
  for (let k = from; k <= to; k++) {
    const c = series.at(k);
    if (c) bodies.push(c);
  }
  const step = candleStep(bodies, price, niceStep);
  return { win: { center: price, half: (SPAN_STEPS * step) / HALF, top, bottom }, step };
}

export function drawCandles(
  ctx: CanvasRenderingContext2D,
  t: ChartTheme,
  series: CandleSeries,
  l: CandleLayout,
  win: YWindow,
  alpha: number,
): void {
  const { from, to } = visibleRange(l.plotW, l.spacing, l.offset);
  const body = bodyWidth(l.spacing);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.rect(0, 0, l.plotW + l.spacing / HALF, win.bottom + win.top);
  ctx.clip();
  for (const rising of [true, false]) {
    ctx.strokeStyle = rising ? t.up : t.down;
    ctx.fillStyle = rising ? t.up : t.down;
    ctx.lineWidth = WICK;
    ctx.beginPath();
    for (let k = from; k <= to; k++) {
      const c = series.at(k);
      if (!c || c.c >= c.o !== rising) continue;
      const x = Math.round(slotX(k, l.plotW, l.spacing, l.offset, series.slide)) + WICK / HALF;
      ctx.moveTo(x, yOf(c.h, win));
      ctx.lineTo(x, yOf(c.l, win));
    }
    ctx.stroke();
    ctx.beginPath();
    for (let k = from; k <= to; k++) {
      const c = series.at(k);
      if (!c || c.c >= c.o !== rising) continue;
      const x = slotX(k, l.plotW, l.spacing, l.offset, series.slide);
      const y1 = yOf(Math.max(c.o, c.c), win);
      const y2 = yOf(Math.min(c.o, c.c), win);
      ctx.rect(Math.round(x - body / HALF), Math.round(y1), body, Math.max(1, Math.round(y2 - y1)));
    }
    ctx.fill();
  }
  ctx.restore();
}

/** The crosshair at a pointer: its candle and price detent, the lines, and the candle's read-out. Null off a candle. */
export function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  t: ChartTheme,
  series: CandleSeries,
  l: CandleLayout,
  win: YWindow,
  step: number,
  at: { x: number; y: number },
  unit: PriceUnit,
): string | null {
  const priceAt = (y: number) =>
    win.center + (((win.top + win.bottom) / HALF - y) / ((win.bottom - win.top) / HALF)) * win.half;
  const d = detent(
    at.x,
    priceAt(at.y),
    { plotW: l.plotW, spacing: l.spacing, offset: l.offset, slide: series.slide },
    step,
  );
  const c = series.at(d.k);
  if (!c) return null;
  const x = slotX(d.k, l.plotW, l.spacing, l.offset, series.slide);
  const y = yOf(d.price, win);
  ctx.save();
  ctx.strokeStyle = t.helper;
  ctx.setLineDash([...CROSS_DASH]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, win.top);
  ctx.lineTo(x, win.bottom);
  ctx.moveTo(0, y);
  ctx.lineTo(l.plotW, y);
  ctx.stroke();
  ctx.setLineDash([]);
  const lines = [
    `O ${formatPrice(c.o, undefined, unit)}`,
    `H ${formatPrice(c.h, undefined, unit)}`,
    `L ${formatPrice(c.l, undefined, unit)}`,
    `C ${formatPrice(c.c, undefined, unit)}`,
  ];
  ctx.font = t.tagFont;
  const w = Math.max(...lines.map((s) => ctx.measureText(s).width)) + READOUT_PAD * HALF;
  const h = lines.length * READOUT_LINE + READOUT_PAD;
  // In the plot's top-right corner: the order stack sits on its left edge.
  const left = l.plotW - w - READOUT_PAD;
  const top = win.top;
  ctx.globalAlpha = READOUT_ALPHA;
  ctx.fillStyle = t.inverse;
  ctx.fillRect(left, top, w, h);
  ctx.globalAlpha = 1;
  ctx.fillStyle = t.ink;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  lines.forEach((s, i) => {
    ctx.fillText(s, left + READOUT_PAD, top + READOUT_PAD / HALF + i * READOUT_LINE);
  });
  ctx.restore();
  return `${d.k}:${d.price}`;
}

/** The crossfade between the line and the candles (R5.17), Tradash's 200 ms. */
const CROSSFADE_MS = 200;
/** Recentring eases the scroll home by this share a frame (Tradash's 0.2). */
const RECENTRE = 0.2;
const RECENTRE_DONE = 0.01;
/** Within this many candles of the oldest loaded, older history is asked for. */
const OLDER_WITHIN = 20;
/** The fewest candles kept on screen when scrolled back. */
const KEEP_VISIBLE = 5;

/**
 * The candle view's state in the engine: the series (null in line view) and the clock its buckets keep, the
 * crossfade to and from the line, and the crosshair — a new detent under it asks for a haptic tick (`onDetent`).
 */
export class CandleLayer {
  view: { series: CandleSeries; now: () => number } | null = null;
  crosshair: { x: number; y: number } | null = null;
  onDetent: (() => void) | null = null;
  /** Older history wanted before the oldest candle held (its start, ms). */
  onOlder: ((oldestT: number) => void) | null = null;
  mix = 0;
  /** Pan and pinch (Owarine's candle gestures): candles scrolled back, and px per candle (null: fitted). */
  offset = 0;
  spacing: number | null = null;
  private recentring = false;
  private olderAsked = new Set<number>();
  private lastDetent: string | null = null;
  private series: CandleSeries | null = null;

  /** Each frame: the forming candle follows the price; the crossfade moves towards the chosen view. */
  tick(dtMs: number, reduced: boolean, raw: number, eased: number): void {
    const want = this.view ? 1 : 0;
    this.mix = reduced
      ? want
      : this.mix + Math.sign(want - this.mix) * Math.min(Math.abs(want - this.mix), dtMs / CROSSFADE_MS);
    if (this.view) this.series = this.view.series;
    if (this.mix === 0) this.series = null;
    if (!this.view) return;
    this.view.series.update(raw, eased, this.view.now());
    this.view.series.decay();
    if (this.recentring) {
      this.offset = this.offset * (1 - RECENTRE);
      if (this.offset < RECENTRE_DONE) {
        this.offset = 0;
        this.recentring = false;
      }
    }
  }

  /** The layout for this frame's plot. */
  layout(plotW: number, fitted: number): CandleLayout {
    return { plotW, spacing: this.spacing ?? fitted, offset: this.offset };
  }

  /** A drag of `dx` px (right reaches back into history); near the oldest held, older history is asked for. */
  pan(dx: number, l: CandleLayout): void {
    const s = this.view?.series;
    if (!s) return;
    this.recentring = false;
    const most = Math.max(0, s.count - KEEP_VISIBLE);
    this.offset = Math.min(most, Math.max(0, this.offset + dx / l.spacing));
    const visible = l.plotW / l.spacing;
    const oldest = s.at(s.count - 1)?.t;
    if (oldest !== undefined && this.offset + visible > s.count - OLDER_WITHIN && !this.olderAsked.has(oldest)) {
      this.olderAsked.add(oldest);
      this.onOlder?.(oldest);
    }
  }

  /** A wheel or pinch by `factor` (> 1 widens the candles). */
  zoom(factor: number, l: CandleLayout): void {
    this.spacing = Math.min(SPACING_MAX, Math.max(SPACING_MIN, l.spacing * factor));
  }

  /** Back to the newest candle at the edge, fitted. */
  recentre(): void {
    this.recentring = true;
    this.spacing = null;
  }

  /** A new series (another market or interval): no scroll, no asks carried over. */
  reset(): void {
    this.offset = 0;
    this.spacing = null;
    this.recentring = false;
    this.olderAsked.clear();
  }

  /** The candles' y-window and step while they lead the crossfade; null while the line does. */
  window(l: CandleLayout, price: number, top: number, bottom: number): { win: YWindow; step: number } | null {
    return this.series && this.mix >= HALF / (HALF * HALF) ? candleWindow(this.series, l, price, top, bottom) : null;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    t: ChartTheme,
    l: CandleLayout,
    win: YWindow,
    step: number,
    unit: PriceUnit,
  ): void {
    if (!this.series || this.mix === 0) return;
    drawCandles(ctx, t, this.series, l, win, this.mix);
    if (!this.crosshair || !this.view) {
      this.lastDetent = null;
      return;
    }
    const key = drawCrosshair(ctx, t, this.series, l, win, step, this.crosshair, unit);
    if (key && key !== this.lastDetent) this.onDetent?.();
    this.lastDetent = key;
  }
}
