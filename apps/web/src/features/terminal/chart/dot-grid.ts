/**
 * The parallax dot field behind the chart (Tradash's `DotGrid`, via Owarine): dots every 34 px, scrolling left at half
 * the line's sample speed and drifting with the price's motion, measured in grid steps so BTC and a $1 asset move alike.
 */
import {
  DOT_RADIUS,
  DOT_SCROLL,
  DOT_SPACING,
  DRIFT_CLAMP,
  DRIFT_EASE,
  DRIFT_GAIN,
  DRIFT_WRAP,
  MAX_DPR,
  SAMPLE_MS,
} from "./constants";

export interface FrameMotion {
  /** Eased price change this frame, in grid steps. */
  velocitySteps: number;
  /** Pixels the line scrolled this frame (0 while it holds still: not live, or a closed market's session). */
  scrollX: number;
  /** This frame's length, so the drift eases at the same speed at 60, 90, 120 or 144 Hz. */
  dtMs: number;
}

export class DotGrid {
  private readonly ctx: CanvasRenderingContext2D;
  private offsetX = 0;
  private targetY = 0;
  private offsetY = 0;
  private width = 0;
  private height = 0;
  private dpr = 1;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private colour: string,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d unavailable");
    this.ctx = ctx;
  }

  setColour(colour: string): void {
    this.colour = colour;
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.max(1, Math.floor(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * this.dpr));
  }

  /** Follows one chart frame (or holds still before the first price). */
  frame(motion: FrameMotion | null, reduced: boolean): void {
    if (motion && !reduced) {
      this.offsetX = (this.offsetX - DOT_SCROLL * motion.scrollX) % DOT_SPACING;
      this.targetY += Math.max(-DRIFT_CLAMP, Math.min(DRIFT_CLAMP, DRIFT_GAIN * motion.velocitySteps * DOT_SPACING));
      this.targetY %= DOT_SPACING * DRIFT_WRAP;
      // DRIFT_EASE is per 60 Hz sample; a frame of any length eases by the same amount per second.
      const ease = 1 - (1 - DRIFT_EASE) ** (motion.dtMs / SAMPLE_MS);
      this.offsetY += (this.targetY - this.offsetY) * ease;
    }
    const { ctx, width: w, height: h } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = this.colour;
    const ox = ((this.offsetX % DOT_SPACING) + DOT_SPACING) % DOT_SPACING;
    const oy = ((this.offsetY % DOT_SPACING) + DOT_SPACING) % DOT_SPACING;
    ctx.beginPath();
    for (let x = ox - DOT_SPACING; x < w + DOT_SPACING; x += DOT_SPACING) {
      for (let y = oy - DOT_SPACING; y < h + DOT_SPACING; y += DOT_SPACING) {
        ctx.moveTo(x + DOT_RADIUS, y);
        ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  }
}
