/**
 * One frame of the live chart, recorded into a Skia picture on the UI thread (immediate mode: the number of ticks,
 * labels and tags changes every frame). Tradash's order (Owarine `chart-engine.ts`/`chart-draw.ts`): dots and the 千両
 * watermark behind; then on one layer the grid, your band's winning zone, the line's 6 px glow and 2 px stroke, and
 * the left 32 % erased with a gradient; then the axis, the K and entry levels, the head dot and the rolling pill.
 * Native calls are the cost (≤ 2 ms gate): the line and the axis ticks are each one path parsed from a string, the
 * dots one picture, and paints come pre-set from the kit (`kit.ts`).
 */
import type { ChartLevel, ChartOverlay } from "@senryo/calls";
import { type SkCanvas, type SkColor, Skia, type SkPicture, TileMode } from "@shopify/react-native-skia";
import { drawOdometer } from "~/components/kit/odometer";
import { type ChartHealth, DIM_ALPHA, HALF_PIXEL, HEALTH_TAG_GAP, LEVEL_ALPHA } from "./constants";
import {
  EDGE_FADE_PX,
  edgeAlpha,
  FADE_FRACTION,
  formatValue,
  gridTicks,
  labelDecimals,
  priceDecimals,
  SPAN_STEPS,
  type YWindow,
  yOf,
} from "./engine";
import { type DrawKit, fill, stroke, textRight } from "./kit";
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
/** Space between two tags stacked at the same edge. */
const EDGE_TAG_GAP = 4;
/** A level tag that would sit under the pill moves to the end of its line, this far left of the head dot. */
const TAG_CLEAR = 8;
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
const MARK_ALPHA = 0.07;
const MARK_MAX_W = 260;
const MARK_PLOT_SHARE = 0.5;
const FADE_MID = 0.45;
/** The ticks' edge fade never takes more than this share of the window at each end. */
const FADE_STOP_MAX = 0.45;
const ROLL_PITCH = 20;
const ROLL_PITCH_SMALL = 15;
const PILL_ROW_OFFSET = 7.5;
const PILL_TEXT_RIGHT = 9;
const HALF = 2;
/** Coordinates in the path strings keep a tenth of a pixel. */
const PX_TENTHS = 10;

export type { ChartLevel, ChartOverlay, LevelKind } from "@senryo/calls";

/** A coordinate for a path string, to a tenth of a pixel. */
function px(v: number): number {
  "worklet";
  return Math.round(v * PX_TENTHS) / PX_TENTHS;
}

function drawDots(c: SkCanvas, dots: SkPicture | null, s: ChartState) {
  "worklet";
  if (!dots) return;
  const ox = ((s.dotX % DOT_SPACING) + DOT_SPACING) % DOT_SPACING;
  const oy = ((s.dotY % DOT_SPACING) + DOT_SPACING) % DOT_SPACING;
  c.save();
  c.translate(ox - DOT_SPACING, oy - DOT_SPACING);
  c.drawPicture(dots);
  c.restore();
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
  textRight(c, k, text, x - TAG_PAD, y + TAG_H / HALF, k.fonts.tag, k.mids.tag, onColor, 1);
}

/** The pill's box: a level tag that would land under it moves to the end of its line instead. */
interface PillBox {
  top: number;
  bottom: number;
}

/** How many tags already sit at each edge this frame: a second level off the same edge stacks under the first. */
interface EdgeSlots {
  up: number;
  down: number;
}

function drawLevel(
  c: SkCanvas,
  k: DrawKit,
  level: ChartLevel,
  win: YWindow,
  plotW: number,
  w: number,
  pill: PillBox,
  edges: EdgeSlots,
) {
  "worklet";
  const color = level.kind === "line" ? k.colors.ink : k.colors.helper;
  const y = yOf(level.price, win);
  const right = w - LABEL_RIGHT;
  if (y < win.top - HALF || y > win.bottom + HALF) {
    const up = y < win.top;
    const text = `${up ? "▲" : "▼"} ${level.label} ${formatValue(level.price, priceDecimals(level.price), k.points)}`;
    const slot = up ? edges.up++ : edges.down++;
    const step = slot * (TAG_H + EDGE_TAG_GAP);
    const at = up ? win.top - PAD_Y + EDGE_TAG_INSET + step : win.bottom + PAD_Y - EDGE_TAG_INSET - TAG_H - step;
    tag(c, k, text, right, at, color, k.colors.inverse);
    return;
  }
  const p = k.paints.level;
  p.setColor(color);
  p.setAlphaf(LEVEL_ALPHA[level.kind]);
  p.setPathEffect(k.dash[level.kind]);
  const ry = Math.round(y) + HALF_PIXEL;
  c.drawLine(0, ry, plotW, ry, p);
  const top = y - TAG_H / HALF;
  const underPill = top < pill.bottom && top + TAG_H > pill.top;
  tag(c, k, level.label, underPill ? plotW - HEAD_R - TAG_CLEAR : right, top, color, k.colors.inverse);
}

/** Where the line's head sits on this frame (the reactions ride it); null while waiting for a price. */
export interface Head {
  x: number;
  y: number;
}

/** The whole frame, recorded into `c`; returns the head so the reactions can ride it. */
export function drawFrame(
  c: SkCanvas,
  k: DrawKit,
  s: ChartState,
  o: ChartOverlay | null,
  w: number,
  h: number,
  waiting: string,
  dots: SkPicture | null,
  health: ChartHealth,
): Head | null {
  "worklet";
  drawDots(c, dots, s);
  // A price that isn't live: the frozen line and its head drawn faint, the age or state beside the pill (R1.20).
  // History is real and labelled: drawn whole. Only a live line gone stale is dimmed.
  const history = s.historySeq !== 0;
  const strength = health.live || history ? 1 : DIM_ALPHA;
  if (!s.ready || w < MIN_PLOT_LEFTOVER || h < PAD_Y * HALF) {
    const x = (w + k.fonts.tag.getTextWidth(waiting)) / HALF;
    textRight(c, k, waiting, x, h / HALF, k.fonts.tag, k.mids.tag, k.colors.helper, 1);
    return null;
  }
  const tone = o?.winning === false ? k.colors.down : k.colors.up;
  const priceText = formatValue(s.latest, priceDecimals(s.latest), k.points);
  const pillTextW = Math.max(
    k.fonts.pill.getTextWidth(priceText),
    o?.pnlText ? k.fonts.pillSmall.getTextWidth(o.pnlText) : 0,
  );
  const pillW = pillTextW + PILL_PAD_X;
  const plotW = Math.min(w - PILL_RIGHT - pillW - PILL_GAP, w - MIN_PLOT_LEFTOVER);
  const win: YWindow = history
    ? { center: s.historyCenter, half: s.historyHalf, top: PAD_Y, bottom: h - PAD_Y }
    : { center: s.eased, half: (SPAN_STEPS * s.step) / HALF, top: PAD_Y, bottom: h - PAD_Y };
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
  if (o?.zone) {
    // The held band's winning prices; an open end runs off the chart (higher prices sit higher).
    const at = (price: number) => Math.min(win.bottom + PAD_Y, Math.max(win.top - PAD_Y, yOf(price, win)));
    const top = o.zone.to === null ? 0 : at(o.zone.to);
    const bottom = o.zone.from === null ? h : at(o.zone.from);
    if (bottom > top) c.drawRect(Skia.XYWHRect(0, top, plotW, bottom - top), fill(k, tone, ZONE_ALPHA));
  }
  // The line as one path string: about one point per pixel (the ring holds more samples than the plot has pixels,
  // so straight segments read as the curve), parsed natively in one call.
  // Shifted left by the part-sample owed, then closed at the plot's edge by the head eased to now (R1.21).
  const n = s.size;
  const stride = Math.max(1, Math.floor((n - 1) / Math.max(1, plotW)));
  const dx = plotW / (n - 1);
  let d = "";
  let headY = 0;
  for (let i = 0; ; i += stride) {
    const at = Math.min(i, n - 1);
    const y = yOf(ringAt(s, at), win);
    d += `${at === 0 ? "M" : "L"}${px((at - s.frac) * dx)} ${px(y)}`;
    headY = y;
    if (at === n - 1) break;
  }
  if (s.frac > 0) {
    headY = yOf(s.head, win);
    d += `L${px(plotW)} ${px(headY)}`;
  }
  const path = Skia.Path.MakeFromSVGString(d);
  if (path) {
    c.drawPath(path, stroke(k, tone, GLOW_W, GLOW_ALPHA * strength));
    c.drawPath(path, stroke(k, tone, LINE_W, strength));
  }
  const fadeW = plotW * FADE_FRACTION;
  const eraser = k.paints.eraser;
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

  const pillH = o?.pnlText ? PILL_H_POSITION : PILL_H;
  const decimals = labelDecimals(win.center, s.step);
  // Ticks on both edges as two paths (major, minor) faded at the window's edges by one gradient; major labels at the
  // right, giving way to the pill and to the level tags (K, entry), as Tradash's fade near the pill.
  let major = "";
  let minor = "";
  for (const t of ticks) {
    const y = Math.round(yOf(t.value, win)) + HALF_PIXEL;
    const edge = edgeAlpha(Math.min(y - win.top, win.bottom - y));
    if (edge <= 0) continue;
    const len = t.major ? MAJOR_TICK : MINOR_TICK;
    const seg = `M${TICK_INSET} ${y}h${len}M${w - TICK_INSET} ${y}h${-len}`;
    if (t.major) major += seg;
    else minor += seg;
    if (!t.major) continue;
    // Labels give way to the pill — and to the health tag beside it when there is one.
    const clearH = health.tag ? pillH + HALF * (HEALTH_TAG_GAP + TAG_H) : pillH;
    let clear = Math.abs(y - headY) - (clearH / HALF + EDGE_FADE_PX / HALF);
    for (const level of o?.levels ?? []) clear = Math.min(clear, Math.abs(y - yOf(level.price, win)) - TAG_H);
    const alpha = edge * edgeAlpha(clear);
    if (alpha > 0) {
      const label = formatValue(t.value, decimals, k.points);
      textRight(c, k, label, w - LABEL_RIGHT, y, k.fonts.axis, k.mids.axis, k.colors.helper, alpha);
    }
  }
  const tick = k.paints.tick;
  const fadeStop = Math.min(FADE_STOP_MAX, EDGE_FADE_PX / Math.max(1, win.bottom - win.top));
  tick.setShader(
    Skia.Shader.MakeLinearGradient(
      Skia.Point(0, win.top),
      Skia.Point(0, win.bottom),
      [k.colors.helperClear, k.colors.helper, k.colors.helper, k.colors.helperClear],
      [0, fadeStop, 1 - fadeStop, 1],
      TileMode.Clamp,
    ),
  );
  for (const [segs, alpha] of [
    [major, MAJOR_TICK_ALPHA],
    [minor, MINOR_TICK_ALPHA],
  ] as const) {
    const ticksPath = segs ? Skia.Path.MakeFromSVGString(segs) : null;
    if (!ticksPath) continue;
    tick.setAlphaf(alpha);
    c.drawPath(ticksPath, tick);
  }
  const pillX = w - PILL_RIGHT - pillW;
  const pillY = Math.min(h - pillH - HALF, Math.max(HALF, headY - pillH / HALF));
  const box: PillBox = { top: pillY, bottom: pillY + pillH };
  const edges: EdgeSlots = { up: 0, down: 0 };
  for (const level of o?.levels ?? []) drawLevel(c, k, level, win, plotW, w, box, edges);

  c.drawCircle(plotW, headY, HEAD_R, fill(k, tone, strength));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(pillX, pillY, pillW, pillH), pillH / HALF, pillH / HALF), fill(k, tone));
  if (health.tag) {
    const below = pillY + pillH + HEALTH_TAG_GAP;
    const top = below + TAG_H <= h ? below : pillY - HEALTH_TAG_GAP - TAG_H;
    textRight(c, k, health.tag, pillX + pillW, top + TAG_H / HALF, k.fonts.tag, k.mids.tag, k.colors.helper, 1);
  }
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
    return { x: plotW, y: headY };
  }
  const mid = pillY + pillH / HALF;
  const ink = fill(k, k.colors.onLine);
  drawOdometer(c, s.price, k.fonts.pillSmall, ink, right, mid - PILL_ROW_OFFSET, ROLL_PITCH_SMALL, pillY, mid);
  drawOdometer(c, s.pnl, k.fonts.pillSmall, ink, right, mid + PILL_ROW_OFFSET, ROLL_PITCH_SMALL, mid, pillY + pillH);
  return { x: plotW, y: headY };
}
