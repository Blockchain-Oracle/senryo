/**
 * The live chart on a canvas (Owarine `chart-engine.ts`, Tradash's renderer, SPEC-chart §§2–4) with Senryo's rules
 * from the phone: each animation frame ease the price toward the latest tick on a fixed 60 Hz sample clock — τ adapts
 * to the feed's cadence, so Pyth's ~1 s ticks glide (D-272) — push it into the 600-sample ring, centre the y-axis on
 * it at ±7.5 frozen steps, then draw: grid, your side's zone against K, the line's glow and stroke, the left 32 %
 * erased, the 千両 mark, the axis, K and the entry, the head dot and the rolling pill. The tone is the up line unless
 * the open call is losing.
 */
import type { ChartOverlay } from "@senryo/calls";
import { formatPrice } from "@senryo/core";
import {
  BASE_TAU_MS,
  FADE_FRACTION,
  FADE_MID,
  FADE_MID_ALPHA,
  GLOW_ALPHA,
  GLOW_W,
  HEAD_R,
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
  TICK_EMA,
  TICK_FOLLOW,
  ZONE_ALPHA,
} from "./constants";
import type { FrameMotion } from "./dot-grid";
import { type ChartTheme, drawAxis, drawGrid, drawLevel, drawMark, drawPill, drawWaiting } from "./draw";
import { catmullRom, SampleRing, stepFor, type YWindow, yOf } from "./engine";
import { CanvasOdometer } from "./odometer";

const HALF = 2;
const MIN_SIZE = 40;

/** Where the head sits this frame (the reactions ride it) and how the line moved (the dots follow it). */
export interface ChartFrame extends FrameMotion {
  headX: number;
  headY: number;
}

export class ChartEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly ring = new SampleRing(SAMPLE_CAPACITY);
  private readonly xs = new Float64Array(SAMPLE_CAPACITY);
  private readonly ys = new Float64Array(SAMPLE_CAPACITY);
  private readonly priceOdo = new CanvasOdometer();
  private readonly pnlOdo = new CanvasOdometer();
  private target: number | null = null;
  private latest: number | null = null;
  private eased = 0;
  private step = 0;
  private overlay: ChartOverlay | null = null;
  /** A running count of the result's moves: the pill's second row rolls the way the result just went. */
  private pnlMoves = 0;
  private lastFrame = 0;
  private sampleDebt = 0;
  private lastTickAt = 0;
  private tickMs = 0;
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

  /** Every tick, unthrottled; the first seeds a flat line. The tick cadence sets how softly the line follows. */
  setPrice(price: number, nowMs: number): void {
    if (!(price > 0) || !Number.isFinite(price)) return;
    const gap = this.lastTickAt === 0 ? 0 : nowMs - this.lastTickAt;
    if (gap > 0 && gap < MAX_TICK_GAP_MS)
      this.tickMs = this.tickMs === 0 ? gap : this.tickMs + TICK_EMA * (gap - this.tickMs);
    this.lastTickAt = nowMs;
    this.latest = price;
    if (this.target === null) {
      this.target = price;
      this.eased = price;
      this.step = stepFor(price);
      this.ring.fill(price);
      return;
    }
    this.target = price;
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
    this.sampleDebt += dt / SAMPLE_MS;
    let pushes = Math.min(MAX_SAMPLES_PER_FRAME, Math.floor(this.sampleDebt));
    this.sampleDebt -= Math.floor(this.sampleDebt);
    const k = reduced ? 1 : 1 - Math.exp(-SAMPLE_MS / Math.max(BASE_TAU_MS, TICK_FOLLOW * this.tickMs));
    while (pushes-- > 0) {
      const d = this.target - this.eased;
      this.eased = Math.abs(d) < SETTLE_FRACTION * Math.abs(this.eased) ? this.target : this.eased + d * k;
      this.ring.push(this.eased);
    }

    const o = this.overlay;
    const tone = o?.winning === false ? theme.down : theme.up;
    const priceText = formatPrice(this.latest);
    this.priceOdo.set(priceText, this.latest);
    this.priceOdo.step(dt);
    this.pnlOdo.step(dt);
    ctx.font = o?.pnlText ? theme.pillSmallFont : theme.pillFont;
    const pillTextW = Math.max(ctx.measureText(priceText).width, o?.pnlText ? ctx.measureText(o.pnlText).width : 0);
    const pillW = pillTextW + PILL_PAD_X;
    const plotW = Math.min(w - PILL_RIGHT - pillW - PILL_GAP, w - MIN_PLOT_LEFTOVER);
    const pillH = o?.pnlText ? PILL_H_POSITION : PILL_H;
    const win: YWindow = { center: this.eased, half: (SPAN_STEPS * this.step) / HALF, top: PAD_Y, bottom: h - PAD_Y };
    const headY = this.drawLine(win, plotW, tone);

    drawMark(ctx, theme, plotW, h);
    drawAxis(ctx, theme, win, this.step, w, headY, pillH, o?.levels ?? []);
    const pill = {
      x: w - PILL_RIGHT - pillW,
      y: Math.min(h - pillH - HALF, Math.max(HALF, headY - pillH / HALF)),
      w: pillW,
      h: pillH,
    };
    const space = { pillTop: pill.y, pillBottom: pill.y + pillH, up: 0, down: 0 };
    for (const level of o?.levels ?? []) drawLevel(ctx, theme, level, win, plotW, w, space);
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.arc(plotW, headY, HEAD_R, 0, Math.PI * HALF);
    ctx.fill();
    drawPill(ctx, theme, pill, tone, this.priceOdo, o?.pnlText ? this.pnlOdo : null);
    return {
      headX: plotW,
      headY,
      velocitySteps: this.step > 0 ? (this.eased - before) / this.step : 0,
      scrollX: plotW / (SAMPLE_CAPACITY - 1),
    };
  }

  /** Grid, zone, glow and line on the layer the fade erases; returns the head's y. */
  private drawLine(win: YWindow, plotW: number, tone: string): number {
    const { ctx, theme, height: h } = this;
    const n = this.ring.length;
    for (let i = 0; i < n; i++) {
      this.xs[i] = (i / (n - 1)) * plotW;
      this.ys[i] = yOf(this.ring.at(i), win);
    }
    const headY = this.ys[n - 1] ?? h / HALF;
    drawGrid(ctx, theme, win, this.step, plotW);
    const o = this.overlay;
    if (o?.line != null && o.zone) {
      const ky = Math.min(win.bottom + PAD_Y, Math.max(win.top - PAD_Y, yOf(o.line, win)));
      const top = o.zone === "above" ? 0 : ky;
      const bottom = o.zone === "above" ? ky : h;
      if (bottom > top) {
        ctx.globalAlpha = ZONE_ALPHA;
        ctx.fillStyle = tone;
        ctx.fillRect(0, top, plotW, bottom - top);
        ctx.globalAlpha = 1;
      }
    }
    const path = new Path2D();
    path.moveTo(this.xs[0] ?? 0, this.ys[0] ?? headY);
    for (let i = 0; i < n - 1; i++) {
      const [c1x, c1y, c2x, c2y] = catmullRom(this.xs, this.ys, i, n);
      path.bezierCurveTo(c1x, c1y, c2x, c2y, this.xs[i + 1] ?? 0, this.ys[i + 1] ?? 0);
    }
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = tone;
    ctx.globalAlpha = GLOW_ALPHA;
    ctx.lineWidth = GLOW_W;
    ctx.stroke(path);
    ctx.globalAlpha = 1;
    ctx.lineWidth = LINE_W;
    ctx.stroke(path);
    // The tail dissolves: erase the left 32 % with a gradient.
    const fadeW = plotW * FADE_FRACTION;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    const fade = ctx.createLinearGradient(0, 0, fadeW, 0);
    fade.addColorStop(0, "rgba(0,0,0,1)");
    fade.addColorStop(FADE_MID, `rgba(0,0,0,${FADE_MID_ALPHA})`);
    fade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, fadeW, h);
    ctx.restore();
    return headY;
  }
}
