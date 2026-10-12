/**
 * The 2D canvas the arcade draws on: the part of the web's `CanvasRenderingContext2D` the draws use, so the same
 * drawing code paints the web's canvas and the phone's Skia picture recorder (`apps/mobile` `skia-2d.ts`). A view is
 * that canvas and its box in CSS pixels (points on the phone) with the backing store's ratio.
 */
export interface Gradient2D {
  addColorStop(offset: number, color: string): void;
}

export interface Ctx2D {
  fillStyle: string | Gradient2D;
  strokeStyle: string | Gradient2D;
  lineWidth: number;
  lineCap: "butt" | "round" | "square";
  lineJoin: "bevel" | "miter" | "round";
  shadowBlur: number;
  shadowColor: string;
  font: string;
  textAlign: "center" | "end" | "left" | "right" | "start";
  textBaseline: "alphabetic" | "bottom" | "hanging" | "ideographic" | "middle" | "top";
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  roundRect(x: number, y: number, w: number, h: number, radius: number): void;
  fill(): void;
  stroke(): void;
  fillText(text: string, x: number, y: number): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): Gradient2D;
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): Gradient2D;
}

export interface ArcadeView {
  ctx: Ctx2D;
  w: number;
  h: number;
  dpr: number;
}

export interface LoopDriver {
  /** One fixed step. */
  step(): void;
  /** Paint the current state, `alpha` (0–1) of the way to the next. */
  draw(view: ArcadeView, alpha: number, nowMs: number): void;
}
