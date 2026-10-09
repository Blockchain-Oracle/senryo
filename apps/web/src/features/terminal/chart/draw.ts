/**
 * The chart's drawing primitives (Owarine `chart-draw.ts`, with the phone's Senryo rules from `draw.ts`): the grid,
 * the axis whose labels give way to the pill and the level tags, the 千両 mark, K and the entry as dashed levels whose
 * tags move clear of the pill or stack at the edge when off-screen, and the capsule pill with its rolling digits.
 * Nothing here keeps state.
 */
import type { ChartLevel } from "@senryo/calls";
import { formatPrice } from "@senryo/core";
import {
  EDGE_FADE_PX,
  EDGE_TAG_GAP,
  EDGE_TAG_INSET,
  GRID_ALPHA,
  HALF_PIXEL,
  HEAD_R,
  LABEL_RIGHT,
  LABEL_SPAN,
  LEVEL_ALPHA,
  LEVEL_DASH,
  MAJOR_TICK,
  MAJOR_TICK_ALPHA,
  MARK,
  MARK_ALPHA,
  MARK_MAX_W,
  MARK_PLOT_SHARE,
  MINOR_TICK,
  MINOR_TICK_ALPHA,
  PAD_Y,
  PILL_ROW_OFFSET,
  PILL_TEXT_RIGHT,
  ROLL_PITCH,
  ROLL_PITCH_SMALL,
  TAG_CLEAR,
  TAG_H,
  TAG_PAD,
  TAG_RADIUS,
  TICK_INSET,
} from "./constants";
import { edgeAlpha, gridTicks, labelDecimals, type YWindow, yOf } from "./engine";
import type { CanvasOdometer } from "./odometer";

const HALF = 2;

/** Colours and canvas fonts, read from the app's tokens (`LiveChart` builds it). */
export interface ChartTheme {
  up: string;
  down: string;
  ink: string;
  inverse: string;
  helper: string;
  onLine: string;
  axisFont: string;
  pillFont: string;
  pillSmallFont: string;
  tagFont: string;
  markFont: string;
}

/** The pill's box (a level tag under it moves to the end of its line) and how many tags sit at each edge. */
export interface TagSpace {
  pillTop: number;
  pillBottom: number;
  up: number;
  down: number;
}

export const ticksIn = (win: YWindow, step: number) =>
  gridTicks(win.center - win.half * LABEL_SPAN, win.center + win.half * LABEL_SPAN, step);

export function drawWaiting(ctx: CanvasRenderingContext2D, t: ChartTheme, text: string, w: number, h: number): void {
  ctx.font = t.tagFont;
  ctx.fillStyle = t.helper;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / HALF, h / HALF);
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  t: ChartTheme,
  win: YWindow,
  step: number,
  plotW: number,
): void {
  ctx.strokeStyle = t.ink;
  ctx.globalAlpha = GRID_ALPHA;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const tick of ticksIn(win, step)) {
    if (!tick.major) continue;
    const y = Math.round(yOf(tick.value, win)) + HALF_PIXEL;
    ctx.moveTo(0, y);
    ctx.lineTo(plotW, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Ticks on both edges and major labels at the right, fading near the edges, the pill and the level tags. */
export function drawAxis(
  ctx: CanvasRenderingContext2D,
  t: ChartTheme,
  win: YWindow,
  step: number,
  w: number,
  headY: number,
  pillH: number,
  levels: readonly ChartLevel[],
): void {
  const decimals = labelDecimals(win.center, step);
  ctx.lineWidth = 1;
  ctx.strokeStyle = t.helper;
  ctx.font = t.axisFont;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = t.helper;
  for (const tick of ticksIn(win, step)) {
    const y = Math.round(yOf(tick.value, win)) + HALF_PIXEL;
    const edge = edgeAlpha(Math.min(y - win.top, win.bottom - y));
    if (edge <= 0) continue;
    const len = tick.major ? MAJOR_TICK : MINOR_TICK;
    ctx.globalAlpha = (tick.major ? MAJOR_TICK_ALPHA : MINOR_TICK_ALPHA) * edge;
    ctx.beginPath();
    ctx.moveTo(TICK_INSET, y);
    ctx.lineTo(TICK_INSET + len, y);
    ctx.moveTo(w - TICK_INSET, y);
    ctx.lineTo(w - TICK_INSET - len, y);
    ctx.stroke();
    if (!tick.major) continue;
    let clear = Math.abs(y - headY) - (pillH / HALF + EDGE_FADE_PX / HALF);
    for (const level of levels) clear = Math.min(clear, Math.abs(y - yOf(level.price, win)) - TAG_H);
    ctx.globalAlpha = edge * edgeAlpha(clear);
    if (ctx.globalAlpha > 0) ctx.fillText(formatPrice(tick.value, decimals), w - LABEL_RIGHT, y);
  }
  ctx.globalAlpha = 1;
}

/** 千両 behind everything at 7 %, at most half the plot (260 px) wide. */
export function drawMark(ctx: CanvasRenderingContext2D, t: ChartTheme, plotW: number, h: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "destination-over";
  ctx.globalAlpha = MARK_ALPHA;
  ctx.font = t.markFont;
  ctx.fillStyle = t.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const scale = Math.min(MARK_PLOT_SHARE * plotW, MARK_MAX_W) / (ctx.measureText(MARK).width || 1);
  ctx.translate(plotW / HALF, h / HALF);
  ctx.scale(scale, scale);
  ctx.fillText(MARK, 0, 0);
  ctx.restore();
}

/** A tag right-aligned at `right`. */
function tag(ctx: CanvasRenderingContext2D, t: ChartTheme, text: string, right: number, y: number, fill: string): void {
  const width = ctx.measureText(text).width + TAG_PAD * HALF;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(right - width, y, width, TAG_H, TAG_RADIUS);
  ctx.fill();
  ctx.fillStyle = t.inverse;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(text, right - TAG_PAD, y + TAG_H / HALF + HALF_PIXEL);
}

/** K (ink, fine dash) or the entry (helper, longer dash): the line and its tag, or off-screen a tag at the edge. */
export function drawLevel(
  ctx: CanvasRenderingContext2D,
  t: ChartTheme,
  level: ChartLevel,
  win: YWindow,
  plotW: number,
  w: number,
  space: TagSpace,
): void {
  const colour = level.kind === "line" ? t.ink : t.helper;
  const y = yOf(level.price, win);
  const right = w - LABEL_RIGHT;
  ctx.font = t.tagFont;
  if (y < win.top - HALF || y > win.bottom + HALF) {
    const up = y < win.top;
    const slot = up ? space.up++ : space.down++;
    const offset = slot * (TAG_H + EDGE_TAG_GAP);
    const at = up ? win.top - PAD_Y + EDGE_TAG_INSET + offset : win.bottom + PAD_Y - EDGE_TAG_INSET - TAG_H - offset;
    tag(ctx, t, `${up ? "▲" : "▼"} ${level.label} ${formatPrice(level.price)}`, right, at, colour);
    return;
  }
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.globalAlpha = LEVEL_ALPHA[level.kind];
  ctx.lineWidth = 1;
  ctx.setLineDash([...LEVEL_DASH[level.kind]]);
  ctx.beginPath();
  ctx.moveTo(0, Math.round(y) + HALF_PIXEL);
  ctx.lineTo(plotW, Math.round(y) + HALF_PIXEL);
  ctx.stroke();
  ctx.restore();
  const top = y - TAG_H / HALF;
  const underPill = top < space.pillBottom && top + TAG_H > space.pillTop;
  tag(ctx, t, level.label, underPill ? plotW - HEAD_R - TAG_CLEAR : right, top, colour);
}

/** The capsule pill at the head: the price rolling and, with a call open, its result beneath. */
export function drawPill(
  ctx: CanvasRenderingContext2D,
  t: ChartTheme,
  box: { x: number; y: number; w: number; h: number },
  tone: string,
  price: CanvasOdometer,
  pnl: CanvasOdometer | null,
): void {
  ctx.fillStyle = tone;
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.w, box.h, box.h / HALF);
  ctx.fill();
  ctx.fillStyle = t.onLine;
  const right = box.x + box.w - PILL_TEXT_RIGHT;
  const mid = box.y + box.h / HALF;
  if (!pnl) {
    ctx.font = t.pillFont;
    price.draw(ctx, right, mid + HALF_PIXEL, ROLL_PITCH, box.y, box.y + box.h);
    return;
  }
  ctx.font = t.pillSmallFont;
  price.draw(ctx, right, mid - PILL_ROW_OFFSET, ROLL_PITCH_SMALL, box.y, mid);
  pnl.draw(ctx, right, mid + PILL_ROW_OFFSET, ROLL_PITCH_SMALL, mid, box.y + box.h);
}
