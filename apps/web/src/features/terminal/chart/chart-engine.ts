/**
 * The live chart on a canvas (Owarine `chart-engine.ts`, Tradash's renderer, SPEC-chart §§2–4) with Senryo's rules
 * from the phone: each animation frame ease the price toward the latest tick on a fixed 60 Hz sample clock — τ adapts
 * to the feed's cadence, so Pyth's ~1 s ticks glide (D-272) — push it into the 600-sample ring, centre the y-axis on
 * it at ±7.5 frozen steps, then draw: grid, your band's winning zone, the line's glow and stroke, the left 32 %
 * erased, the 千両 mark, the axis, K and the entry, the head dot and the rolling pill. The tone is the up line unless
 * the open call is losing.
 */
import type { ChartOverlay, SessionHistory } from "@senryo/calls";
import { formatPrice, type PriceUnit } from "@senryo/core";
import {
  BASE_TAU_MS,
  DIM_ALPHA,
  FADE_FRACTION,
  FADE_MID,
  FADE_MID_ALPHA,
  GLOW_ALPHA,
  GLOW_W,
  HEAD_R,
  HEALTH_TAG_GAP,
  HISTORY_PAD,
  LINE_W,
  MAX_DPR,
  MAX_FRAME_MS,
  MAX_SAMPLES_PER_FRAME,
  MAX_TICK_GAP_MS,
  MIN_PLOT_LEFTOVER,
  PAD_Y,
  PILL_GAP,
  PILL_H,
  PILL_H_POSITION,
  PILL_PAD_X,
  PILL_RIGHT,
  SAMPLE_CAPACITY,
  SAMPLE_MS,
  SETTLE_FRACTION,
  SPAN_STEPS,
  TAG_H,
  TICK_EMA,
  TICK_FOLLOW,
  ZONE_ALPHA,
} from "./constants";
import type { FrameMotion } from "./dot-grid";
import { type ChartTheme, drawAxis, drawGrid, drawHealthTag, drawLevel, drawMark, drawPill, drawWaiting } from "./draw";
import { catmullRom, niceStep, SampleRing, stepFor, type YWindow, yOf } from "./engine";
import { CanvasOdometer } from "./odometer";

const HALF = 2;
/** `[c1x, c1y, c2x, c2y]` for one Bézier segment. */
const CONTROL_POINTS = 4;
const MIN_SIZE = 40;

/** Whether the price is live, and its age or state for the tag when it isn't (`PriceHealth`, R1.20). */
export interface ChartHealth {
  live: boolean;
  tag: string | null;
}
export const LIVE: ChartHealth = { live: true, tag: null };

/** Where the head sits this frame (the reactions ride it) and how the line moved (the dots follow it). */
export interface ChartFrame extends FrameMotion {
  headX: number;
  headY: number;
}

export class ChartEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly ring = new SampleRing(SAMPLE_CAPACITY);
  /** The ring's points plus the head at "now" (sub-sample scroll); `cp` is the control-point buffer. */
  private readonly xs = new Float64Array(SAMPLE_CAPACITY + 1);
  private readonly ys = new Float64Array(SAMPLE_CAPACITY + 1);
  private readonly cp = new Float64Array(CONTROL_POINTS);
  /** The tail's fade, made once per size. */
  private fade: { w: number; h: number; gradient: CanvasGradient } | null = null;
  private readonly priceOdo = new CanvasOdometer();
  private readonly pnlOdo = new CanvasOdometer();
  private target: number | null = null;
  private latest: number | null = null;
  private eased = 0;
  private step = 0;
  private overlay: ChartOverlay | null = null;
  /** The price's health (R1.20): not live → the line freezes, dims and carries its age or state. */
  private health: ChartHealth = LIVE;
  /** A closed market's last session, drawn whole and still on its own scale (null while it trades). */
  private history: SessionHistory | null = null;
  private historyHalf = 0;
  /** A running count of the result's moves: the pill's second row rolls the way the result just went. */
  private pnlMoves = 0;
  private lastFrame = 0;
  private sampleDebt = 0;
  private lastTickAt = 0;
  private tickMs = 0;
  private unit: PriceUnit = "usd";
  private width = 0;
  private height = 0;
  private dpr = 1;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private theme: ChartTheme,
    private waiting: string,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d unavailable");
    this.ctx = ctx;
  }

  setTheme(theme: ChartTheme): void {
    this.theme = theme;
  }

  /** Dollars, or points for a basket (D-286): the pill, the axis and the tags read in it. */
  setUnit(unit: PriceUnit): void {
    this.unit = unit;
  }

  /**
   * Every tick, unthrottled. The first seeds the line: from `line` (the last ~10 s of real history, `fillLine`) when
   * there is one, else flat. The tick cadence sets how softly the line follows.
   */
  setPrice(price: number, nowMs: number, line: readonly number[] | null = null): void {
    // A closed market's frozen frames don't move its session chart.
    if (this.history || !(price > 0) || !Number.isFinite(price)) return;
    const gap = this.lastTickAt === 0 ? 0 : nowMs - this.lastTickAt;
    if (gap > 0 && gap < MAX_TICK_GAP_MS)
      this.tickMs = this.tickMs === 0 ? gap : this.tickMs + TICK_EMA * (gap - this.tickMs);
    this.lastTickAt = nowMs;
    this.latest = price;
    if (this.target === null) {
      this.target = price;
      this.eased = price;
      this.step = stepFor(price);
      if (line?.length === SAMPLE_CAPACITY) this.ring.load(line);
      else this.ring.fill(price);
      return;
    }
    this.target = price;
  }

  /**
   * Read every frame. A closed market draws its last session on a scale fitted to it; when it opens again the chart
   * starts afresh from its first live tick.
   */
  setHistory(history: SessionHistory | null): void {
    if (history === this.history) return;
    const had = this.history !== null;
    this.history = history;
    if (!history) {
      if (had) this.reset(this.waiting);
      return;
    }
    const range = history.high - history.low;
    this.ring.load(history.line);
    this.target = history.close;
    this.eased = history.close;
    this.latest = history.close;
    this.step = range > 0 ? niceStep(range / SPAN_STEPS) : stepFor(history.close);
    this.historyHalf = Math.max((range / HALF) * HISTORY_PAD, this.step * HALF);
  }

  /** Read every frame. Back to live, the line resumes from now (no catch-up burst). */
  setHealth(health: ChartHealth): void {
    if (health.live && !this.health.live) this.sampleDebt = 0;
    this.health = health;
  }

  /** The overlay of the latest tick (read every frame; a new object per tick). */
  setOverlay(overlay: ChartOverlay | null): void {
    if (overlay === this.overlay) return;
    if (!overlay?.pnlText !== !this.overlay?.pnlText) this.pnlOdo.reset();
    if (overlay?.pnlText) {
      this.pnlMoves += overlay.pnlTrend;
      this.pnlOdo.set(overlay.pnlText, this.pnlMoves);
    }
    this.overlay = overlay;
  }

  /** A new market: forget the line, the scale and the digits; the next tick starts a flat line. */
  reset(waiting: string): void {
    this.waiting = waiting;
    this.ring.clear();
    this.target = null;
    this.latest = null;
    this.step = 0;
    this.tickMs = 0;
    this.lastTickAt = 0;
    this.priceOdo.reset();
    this.pnlOdo.reset();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.max(1, Math.floor(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * this.dpr));
  }

  /** One animation frame; null before the first tick. */
  frame(nowMs: number, reduced: boolean): ChartFrame | null {
    const dt = this.lastFrame === 0 ? SAMPLE_MS : Math.min(MAX_FRAME_MS, nowMs - this.lastFrame);
    this.lastFrame = nowMs;
    const { ctx, width: w, height: h, theme } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (this.target === null || this.latest === null || w < MIN_SIZE || h < MIN_SIZE) {
      drawWaiting(ctx, theme, this.waiting, w, h);
      return null;
    }
    const before = this.eased;
    // A price that isn't live never scrolls as if it were: the line holds still (04-pricing R7).
    this.sampleDebt = this.health.live && !this.history ? this.sampleDebt + dt / SAMPLE_MS : 0;
    let pushes = Math.min(MAX_SAMPLES_PER_FRAME, Math.floor(this.sampleDebt));
    this.sampleDebt -= Math.floor(this.sampleDebt);
    const tau = Math.max(BASE_TAU_MS, TICK_FOLLOW * this.tickMs);
    const k = reduced ? 1 : 1 - Math.exp(-SAMPLE_MS / tau);
    while (pushes-- > 0) {
      const d = this.target - this.eased;
      this.eased = Math.abs(d) < SETTLE_FRACTION * Math.abs(this.eased) ? this.target : this.eased + d * k;
      this.ring.push(this.eased);
    }

    const o = this.overlay;
    const tone = o?.winning === false ? theme.down : theme.up;
    const priceText = formatPrice(this.latest, undefined, this.unit);
    this.priceOdo.set(priceText, this.latest);
    this.priceOdo.step(dt);
    this.pnlOdo.step(dt);
    ctx.font = o?.pnlText ? theme.pillSmallFont : theme.pillFont;
    const pillTextW = Math.max(ctx.measureText(priceText).width, o?.pnlText ? ctx.measureText(o.pnlText).width : 0);
    const pillW = pillTextW + PILL_PAD_X;
    const plotW = Math.min(w - PILL_RIGHT - pillW - PILL_GAP, w - MIN_PLOT_LEFTOVER);
    const pillH = o?.pnlText ? PILL_H_POSITION : PILL_H;
    const hist = this.history;
    const win: YWindow = hist
      ? { center: (hist.low + hist.high) / HALF, half: this.historyHalf, top: PAD_Y, bottom: h - PAD_Y }
      : { center: this.eased, half: (SPAN_STEPS * this.step) / HALF, top: PAD_Y, bottom: h - PAD_Y };
    // Sub-sample scroll (04-pricing R17): the line shifts by the part-sample owed, and its head eases to "now", so it
    // moves on every frame of a 90, 120 or 144 Hz screen instead of only on frames that push a sample.
    const moving = this.health.live && !this.history;
    const frac = moving ? this.sampleDebt : 0;
    const head =
      reduced || !moving
        ? this.eased
        : this.eased + (this.target - this.eased) * (1 - Math.exp((-frac * SAMPLE_MS) / tau));
    const headY = this.drawLine(win, plotW, tone, frac, head);

    drawMark(ctx, theme, plotW, h);
    // Axis labels give way to the pill — and to the health tag beside it when there is one.
    const clearH = this.health.tag ? pillH + HALF * (HEALTH_TAG_GAP + TAG_H) : pillH;
    drawAxis(ctx, theme, win, this.step, w, headY, clearH, o?.levels ?? [], this.unit);
    const pill = {
      x: w - PILL_RIGHT - pillW,
      y: Math.min(h - pillH - HALF, Math.max(HALF, headY - pillH / HALF)),
      w: pillW,
      h: pillH,
    };
    const space = { pillTop: pill.y, pillBottom: pill.y + pillH, up: 0, down: 0 };
    for (const level of o?.levels ?? []) drawLevel(ctx, theme, level, win, plotW, w, space, this.unit);
    ctx.fillStyle = tone;
    ctx.globalAlpha = this.health.live || this.history ? 1 : DIM_ALPHA;
    ctx.beginPath();
    ctx.arc(plotW, headY, HEAD_R, 0, Math.PI * HALF);
    ctx.fill();
    ctx.globalAlpha = 1;
    drawPill(ctx, theme, pill, tone, this.priceOdo, o?.pnlText ? this.pnlOdo : null);
    if (this.health.tag) drawHealthTag(ctx, theme, this.health.tag, pill, h);
    return {
      headX: plotW,
      headY,
      velocitySteps: this.step > 0 ? (this.eased - before) / this.step : 0,
      scrollX: moving ? (dt / SAMPLE_MS) * (plotW / (SAMPLE_CAPACITY - 1)) : 0,
      dtMs: dt,
    };
  }

  /**
   * Grid, zone, glow and line on the layer the fade erases; returns the head's y. The ring is shifted left by `frac`
   * of a sample and the head point (`head`, the price eased to now) closes the line at the plot's edge.
   */
  private drawLine(win: YWindow, plotW: number, tone: string, frac: number, head: number): number {
    const { ctx, theme, height: h } = this;
    const samples = this.ring.length;
    const dx = plotW / (samples - 1);
    for (let i = 0; i < samples; i++) {
      this.xs[i] = (i - frac) * dx;
      this.ys[i] = yOf(this.ring.at(i), win);
    }
    let n = samples;
    if (frac > 0) {
      this.xs[n] = plotW;
      this.ys[n] = yOf(head, win);
      n += 1;
    }
    const headY = this.ys[n - 1] ?? h / HALF;
    drawGrid(ctx, theme, win, this.step, plotW);
    const o = this.overlay;
    if (o?.zone) {
      // The held band's winning prices; an open end runs off the chart (higher prices sit higher).
      const at = (price: number) => Math.min(win.bottom + PAD_Y, Math.max(win.top - PAD_Y, yOf(price, win)));
      const top = o.zone.to === null ? 0 : at(o.zone.to);
      const bottom = o.zone.from === null ? h : at(o.zone.from);
      if (bottom > top) {
        ctx.globalAlpha = ZONE_ALPHA;
        ctx.fillStyle = tone;
        ctx.fillRect(0, top, plotW, bottom - top);
        ctx.globalAlpha = 1;
      }
    }
    // The context's own path, rebuilt in place (no Path2D per frame) and stroked twice: glow, then line.
    const cp = this.cp;
    ctx.beginPath();
    ctx.moveTo(this.xs[0] ?? 0, this.ys[0] ?? headY);
    for (let i = 0; i < n - 1; i++) {
      catmullRom(this.xs, this.ys, i, n, cp);
      ctx.bezierCurveTo(cp[0] ?? 0, cp[1] ?? 0, cp[2] ?? 0, cp[3] ?? 0, this.xs[i + 1] ?? 0, this.ys[i + 1] ?? 0);
    }
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = tone;
    // History is real and labelled: drawn whole. Only a live line gone stale is dimmed.
    const strength = this.health.live || this.history ? 1 : DIM_ALPHA;
    ctx.globalAlpha = GLOW_ALPHA * strength;
    ctx.lineWidth = GLOW_W;
    ctx.stroke();
    ctx.globalAlpha = strength;
    ctx.lineWidth = LINE_W;
    ctx.stroke();
    ctx.globalAlpha = 1;
    // The tail dissolves: erase the left 32 % with a gradient.
    const fadeW = plotW * FADE_FRACTION;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    if (this.fade?.w !== fadeW || this.fade.h !== h) {
      const gradient = ctx.createLinearGradient(0, 0, fadeW, 0);
      gradient.addColorStop(0, "rgba(0,0,0,1)");
      gradient.addColorStop(FADE_MID, `rgba(0,0,0,${FADE_MID_ALPHA})`);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      this.fade = { w: fadeW, h, gradient };
    }
    ctx.fillStyle = this.fade.gradient;
    ctx.fillRect(0, 0, fadeW, h);
    ctx.restore();
    return headY;
  }
}
