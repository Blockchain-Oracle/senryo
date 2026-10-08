/**
 * One frame of the live chart, recorded into a Skia picture on the UI thread (immediate mode: the number of ticks,
 * labels and tags changes every frame). Tradash's order (Owarine `chart-engine.ts`/`chart-draw.ts`): dots and the 千両
 * watermark behind; then on one layer the grid, your side's zone against K, the line's 6 px glow and 2 px stroke, and
 * the left 32 % erased with a gradient; then the axis, the K and entry levels, the head dot and the rolling pill.
 */
import {
  BlendMode,
  PaintStyle,
  type SkCanvas,
  type SkColor,
  type SkFont,
  Skia,
  type SkPaint,
  type SkPathBuilder,
  type SkPathEffect,
  StrokeCap,
  StrokeJoin,
  TileMode,
} from "@shopify/react-native-skia";
import { drawOdometer } from "~/components/kit/odometer";
import { CATMULL, HALF_PIXEL, LEVEL_ALPHA } from "./constants";
import {
  EDGE_FADE_PX,
  edgeAlpha,
  FADE_FRACTION,
  formatFixed,
  formatUsd,
  gridTicks,
  labelDecimals,
  priceDecimals,
  SPAN_STEPS,
  type YWindow,
  yOf,
} from "./engine";
import { type ChartState, DOT_SPACING, ringAt } from "./state";

export const PAD_Y = 28;
const PILL_RIGHT = 14;
const PILL_GAP = 10;
const PILL_PAD_X = 18;
const MIN_PLOT_LEFTOVER = 96;
const PILL_H = 26;
const PILL_H_POSITION = 34;
const LABEL_RIGHT = 14;
const TAG_H = 15;
const TAG_PAD = 5;
const TAG_RADIUS = 3;
const EDGE_TAG_INSET = 9;
const HEAD_R = 3.5;
const GLOW_W = 6;
const GLOW_ALPHA = 0.18;
const LINE_W = 2;
const GRID_ALPHA = 0.06;
const ZONE_ALPHA = 0.07;
const MAJOR_TICK = 6;
const MINOR_TICK = 3;
const TICK_INSET = 3;
const MAJOR_TICK_ALPHA = 0.9;
const MINOR_TICK_ALPHA = 0.45;
const LABEL_SPAN = 1.2;
const DOT_R = 1.1;
const DOT_ALPHA = 0.14;
const MARK_ALPHA = 0.07;
const MARK_MAX_W = 260;
const MARK_PLOT_SHARE = 0.5;
const FADE_MID = 0.45;
const ROLL_PITCH = 20;
const ROLL_PITCH_SMALL = 15;
const PILL_ROW_OFFSET = 7.5;
const PILL_TEXT_RIGHT = 9;
const HALF = 2;

export type LevelKind = "line" | "entry";

export interface ChartLevel {
  kind: LevelKind;
  price: number;
  label: string;
}

/** What the chart overlays for the open call (set from React on events; read every frame). */
export interface ChartOverlay {
  /** Winning (≥ 0) keeps the up tone; losing turns everything the down tone. Null when flat. */
  winning: boolean | null;
  /** The pill's second row ("+$1.24"), when a call is open. */
  pnlText: string | null;
  /** Which way the result just moved (the pill's second row rolls up or down). */
  pnlTrend: number;
  /** K and the call's side: the zone above K (Up) or below it (Down) is shaded. */
  line: number | null;
  zone: "above" | "below" | null;
  levels: ChartLevel[];
}

export interface DrawKit {
  paint: SkPaint;
  line: SkPathBuilder;
  zone: SkPathBuilder;
  fonts: { axis: SkFont; pill: SkFont; pillSmall: SkFont; tag: SkFont; mark: SkFont | null };
  colors: { up: SkColor; down: SkColor; ink: SkColor; inverse: SkColor; helper: SkColor; onLine: SkColor };
  dash: { line: SkPathEffect; entry: SkPathEffect };
  /** The fade's erasing gradient stops (opaque → clear). */
  fade: { solid: SkColor; mid: SkColor; clear: SkColor };
  mark: string;
}

function fill(k: DrawKit, color: SkColor, alpha = 1): SkPaint {
  "worklet";
  const p = k.paint;
  p.reset();
  p.setAntiAlias(true);
  p.setStyle(PaintStyle.Fill);
  p.setColor(color);
  p.setAlphaf(alpha);
  return p;
}

function stroke(k: DrawKit, color: SkColor, width: number, alpha = 1): SkPaint {
  "worklet";
  const p = fill(k, color, alpha);
  p.setStyle(PaintStyle.Stroke);
  p.setStrokeWidth(width);
  p.setStrokeCap(StrokeCap.Round);
  p.setStrokeJoin(StrokeJoin.Round);
  return p;
}

function textRight(
  c: SkCanvas,
  k: DrawKit,
  text: string,
  right: number,
  midY: number,
  font: SkFont,
  color: SkColor,
  alpha: number,
) {
  "worklet";
  const w = font.getTextWidth(text);
  const m = font.getMetrics();
  c.drawText(text, right - w, midY - (m.ascent + m.descent) / HALF, fill(k, color, alpha), font);
}

function drawDots(c: SkCanvas, k: DrawKit, s: ChartState, w: number, h: number) {
  "worklet";
  const p = fill(k, k.colors.ink, DOT_ALPHA);
  const ox = ((s.dotX % DOT_SPACING) + DOT_SPACING) % DOT_SPACING;
  const oy = ((s.dotY % DOT_SPACING) + DOT_SPACING) % DOT_SPACING;
  for (let x = ox - DOT_SPACING; x < w + DOT_SPACING; x += DOT_SPACING)
    for (let y = oy - DOT_SPACING; y < h + DOT_SPACING; y += DOT_SPACING) c.drawCircle(x, y, DOT_R, p);
}

function drawMark(c: SkCanvas, k: DrawKit, plotW: number, h: number) {
  "worklet";
  const font = k.fonts.mark;
  if (!font) return;
  const natural = font.getTextWidth(k.mark) || 1;
  const scale = Math.min(MARK_PLOT_SHARE * plotW, MARK_MAX_W) / natural;
  const m = font.getMetrics();
  c.save();
  c.translate(plotW / HALF, h / HALF);
  c.scale(scale, scale);
  c.drawText(k.mark, -natural / HALF, -(m.ascent + m.descent) / HALF, fill(k, k.colors.ink, MARK_ALPHA), font);
  c.restore();
}

function tag(c: SkCanvas, k: DrawKit, text: string, x: number, y: number, color: SkColor, onColor: SkColor) {
  "worklet";
  const w = k.fonts.tag.getTextWidth(text) + TAG_PAD * HALF;
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x - w, y, w, TAG_H), TAG_RADIUS, TAG_RADIUS), fill(k, color));
  textRight(c, k, text, x - TAG_PAD, y + TAG_H / HALF, k.fonts.tag, onColor, 1);
}

function drawLevel(c: SkCanvas, k: DrawKit, level: ChartLevel, win: YWindow, plotW: number, w: number) {
  "worklet";
  const color = level.kind === "line" ? k.colors.ink : k.colors.helper;
  const y = yOf(level.price, win);
  const right = w - LABEL_RIGHT;
  if (y < win.top - HALF || y > win.bottom + HALF) {
    const up = y < win.top;
    const text = `${up ? "▲" : "▼"} ${level.label} $${formatFixed(level.price, priceDecimals(level.price))}`;
    tag(
      c,
      k,
      text,
      right,
      up ? win.top - PAD_Y + EDGE_TAG_INSET : win.bottom + PAD_Y - EDGE_TAG_INSET - TAG_H,
      color,
      k.colors.inverse,
    );
    return;
  }
  const p = stroke(k, color, 1, LEVEL_ALPHA[level.kind]);
  p.setPathEffect(level.kind === "line" ? k.dash.line : k.dash.entry);
  const ry = Math.round(y) + HALF_PIXEL;
  c.drawLine(0, ry, plotW, ry, p);
  tag(c, k, level.label, right, y - TAG_H / HALF, color, k.colors.inverse);
}

/** The whole frame. Returns nothing: the picture is the output. */
export function drawFrame(
  c: SkCanvas,
  k: DrawKit,
  s: ChartState,
  o: ChartOverlay | null,
  w: number,
  h: number,
  waiting: string,
) {
  "worklet";
  drawDots(c, k, s, w, h);
  if (!s.ready || w < MIN_PLOT_LEFTOVER || h < PAD_Y * HALF) {
    textRight(c, k, waiting, (w + k.fonts.tag.getTextWidth(waiting)) / HALF, h / HALF, k.fonts.tag, k.colors.helper, 1);
    return;
  }
  const tone = o?.winning === false ? k.colors.down : k.colors.up;
  const priceText = formatUsd(s.latest, priceDecimals(s.latest));
  const pillTextW = Math.max(
    k.fonts.pill.getTextWidth(priceText),
    o?.pnlText ? k.fonts.pillSmall.getTextWidth(o.pnlText) : 0,
  );
  const pillW = pillTextW + PILL_PAD_X;
  const plotW = Math.min(w - PILL_RIGHT - pillW - PILL_GAP, w - MIN_PLOT_LEFTOVER);
  const win: YWindow = { center: s.eased, half: (SPAN_STEPS * s.step) / HALF, top: PAD_Y, bottom: h - PAD_Y };
  drawMark(c, k, plotW, h);

  // The layer the fade erases: grid, zone, glow and line.
  c.saveLayer();
  const lo = win.center - win.half * LABEL_SPAN;
  const hi = win.center + win.half * LABEL_SPAN;
  const ticks = gridTicks(lo, hi, s.step);
  const grid = stroke(k, k.colors.ink, 1, GRID_ALPHA);
  for (const t of ticks) {
    if (!t.major) continue;
    const y = Math.round(yOf(t.value, win)) + HALF_PIXEL;
    c.drawLine(0, y, plotW, y, grid);
  }
  if (o?.line !== null && o?.line !== undefined && o.zone) {
    const ky = Math.min(win.bottom + PAD_Y, Math.max(win.top - PAD_Y, yOf(o.line, win)));
    const top = o.zone === "above" ? 0 : ky;
    const bottom = o.zone === "above" ? ky : h;
    if (bottom > top) c.drawRect(Skia.XYWHRect(0, top, plotW, bottom - top), fill(k, tone, ZONE_ALPHA));
  }
  const n = s.size;
  const b = k.line;
  b.reset();
  let headY = 0;
  let px = 0;
  let py = 0;
  let ppx = 0;
  let ppy = 0;
  for (let i = 0; i < n; i += 1) {
    const x = (i / (n - 1)) * plotW;
    const y = yOf(ringAt(s, i), win);
    if (i === 0) b.moveTo(x, y);
    else {
      // Catmull-Rom (1/6) through the previous two points and this one (next = this, at the head).
      const nx = i + 1 < n ? ((i + 1) / (n - 1)) * plotW : x;
      const ny = i + 1 < n ? yOf(ringAt(s, i + 1), win) : y;
      const ax = i > 1 ? ppx : px;
      const ay = i > 1 ? ppy : py;
      b.cubicTo(
        px + (x - ax) / CATMULL,
        py + (y - ay) / CATMULL,
        x - (nx - px) / CATMULL,
        y - (ny - py) / CATMULL,
        x,
        y,
      );
    }
    ppx = px;
    ppy = py;
    px = x;
    py = y;
    headY = y;
  }
  const path = b.build();
  c.drawPath(path, stroke(k, tone, GLOW_W, GLOW_ALPHA));
  c.drawPath(path, stroke(k, tone, LINE_W));
  const fadeW = plotW * FADE_FRACTION;
  const eraser = fill(k, k.fade.solid);
  eraser.setBlendMode(BlendMode.DstOut);
  eraser.setShader(
    Skia.Shader.MakeLinearGradient(
      Skia.Point(0, 0),
      Skia.Point(fadeW, 0),
      [k.fade.solid, k.fade.mid, k.fade.clear],
      [0, FADE_MID, 1],
      TileMode.Clamp,
    ),
  );
  c.drawRect(Skia.XYWHRect(0, 0, fadeW, h), eraser);
  c.restore();

  // Axis: ticks on both edges, major labels at the right, fading near the edges and the pill.
  const pillH = o?.pnlText ? PILL_H_POSITION : PILL_H;
  const decimals = labelDecimals(win.center, s.step);
  for (const t of ticks) {
    const y = Math.round(yOf(t.value, win)) + HALF_PIXEL;
    const edge = edgeAlpha(Math.min(y - win.top, win.bottom - y));
    if (edge <= 0) continue;
    const len = t.major ? MAJOR_TICK : MINOR_TICK;
    const tick = stroke(k, k.colors.helper, 1, (t.major ? MAJOR_TICK_ALPHA : MINOR_TICK_ALPHA) * edge);
    c.drawLine(TICK_INSET, y, TICK_INSET + len, y, tick);
    c.drawLine(w - TICK_INSET, y, w - TICK_INSET - len, y, tick);
    if (!t.major) continue;
    // Labels give way to the pill and to the level tags (K, entry), as Tradash's fade near the pill.
    let clear = Math.abs(y - headY) - (pillH / HALF + EDGE_FADE_PX / HALF);
    for (const level of o?.levels ?? []) clear = Math.min(clear, Math.abs(y - yOf(level.price, win)) - TAG_H);
    const alpha = edge * edgeAlpha(clear);
    if (alpha > 0)
      textRight(c, k, `$${formatFixed(t.value, decimals)}`, w - LABEL_RIGHT, y, k.fonts.axis, k.colors.helper, alpha);
  }
  for (const level of o?.levels ?? []) drawLevel(c, k, level, win, plotW, w);

  c.drawCircle(plotW, headY, HEAD_R, fill(k, tone));
  const pillX = w - PILL_RIGHT - pillW;
  const pillY = Math.min(h - pillH - HALF, Math.max(HALF, headY - pillH / HALF));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(pillX, pillY, pillW, pillH), pillH / HALF, pillH / HALF), fill(k, tone));
  const right = pillX + pillW - PILL_TEXT_RIGHT;
  if (!o?.pnlText) {
    drawOdometer(
      c,
      s.price,
      k.fonts.pill,
      fill(k, k.colors.onLine),
      right,
      pillY + pillH / HALF,
      ROLL_PITCH,
      pillY,
      pillY + pillH,
    );
    return;
  }
  const mid = pillY + pillH / HALF;
  const ink = fill(k, k.colors.onLine);
  drawOdometer(c, s.price, k.fonts.pillSmall, ink, right, mid - PILL_ROW_OFFSET, ROLL_PITCH_SMALL, pillY, mid);
  drawOdometer(c, s.pnl, k.fonts.pillSmall, ink, right, mid + PILL_ROW_OFFSET, ROLL_PITCH_SMALL, mid, pillY + pillH);
}
