/**
 * The arcade's drawing (S8.8): the engines' state on a canvas, in the field's 640×360 units scaled to the canvas.
 * Reads the state, never steers it. Colours come from the theme's tokens, read once per run.
 */
import { FIELD_H, FIELD_W, FLAP, type FlapState, RIDE, type RideState, rideLineYAt } from "@senryo/core";

export interface ArcadeInk {
  ground: string;
  line: string;
  pip: string;
  up: string;
  down: string;
  faint: string;
  text: string;
}

const LINE_WIDTH = 3;
const PIP_RADIUS = 7;
const GRIP_BAR_W = 120;
const GRIP_BAR_H = 6;
const HUD_PAD = 14;
const HUD_FONT = "600 18px ui-sans-serif, system-ui";
const SMALL_FONT = "500 12px ui-sans-serif, system-ui";
const WICK_W = 2;
const BODY_RADIUS = 4;
const BIRD_RADIUS = 11;
const HALF = 2;
const FULL_TURN = Math.PI * HALF;
const SMALL_GAP = 6;

export function readInk(el: HTMLElement): ArcadeInk {
  const css = getComputedStyle(el);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    ground: v("--card", "#111"),
    line: v("--primary", "#fff"),
    pip: v("--foreground", "#fff"),
    up: v("--up", "#25cf68"),
    down: v("--down", "#ff5a48"),
    faint: v("--secondary", "#333"),
    text: v("--foreground", "#fff"),
  };
}

function begin(ctx: CanvasRenderingContext2D, ink: ArcadeInk): void {
  const { width, height } = ctx.canvas;
  ctx.setTransform(width / FIELD_W, 0, 0, height / FIELD_H, 0, 0);
  ctx.fillStyle = ink.ground;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
}

export function drawRide(ctx: CanvasRenderingContext2D, s: RideState, ink: ArcadeInk, alpha: number): void {
  begin(ctx, ink);
  const worldX = s.worldXPrev + (s.worldX - s.worldXPrev) * alpha;
  ctx.strokeStyle = s.onLine ? ink.up : ink.line;
  ctx.lineWidth = LINE_WIDTH;
  ctx.beginPath();
  for (let x = 0; x <= FIELD_W; x += RIDE.segPx / HALF) {
    const y = rideLineYAt(s, x, worldX) * FIELD_H;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  const pipY = (s.pipYPrev + (s.pipY - s.pipYPrev) * alpha) * FIELD_H;
  ctx.fillStyle = s.onLine ? ink.up : ink.down;
  ctx.beginPath();
  ctx.arc(RIDE.pipX, pipY, PIP_RADIUS, 0, FULL_TURN);
  ctx.fill();
  hud(ctx, ink, `${Math.round(s.score)}`, `×${s.mult.toFixed(1)}`);
  ctx.fillStyle = ink.faint;
  ctx.fillRect(FIELD_W - HUD_PAD - GRIP_BAR_W, HUD_PAD, GRIP_BAR_W, GRIP_BAR_H);
  ctx.fillStyle = s.grip > 1 / HALF ? ink.up : ink.down;
  ctx.fillRect(FIELD_W - HUD_PAD - GRIP_BAR_W, HUD_PAD, GRIP_BAR_W * s.grip, GRIP_BAR_H);
}

export function drawFlap(ctx: CanvasRenderingContext2D, s: FlapState, ink: ArcadeInk, alpha: number): void {
  begin(ctx, ink);
  const shift = (s.worldX - s.worldXPrev) * (1 - alpha);
  for (const c of s.candles) {
    const x = c.x + shift;
    const top = (c.center - c.half) * FIELD_H;
    const bottom = (c.center + c.half) * FIELD_H;
    ctx.fillStyle = ink.down;
    ctx.fillRect(x - WICK_W / HALF, top - FLAP.wick, WICK_W, FLAP.wick);
    ctx.beginPath();
    ctx.roundRect(x - FLAP.bodyW / HALF, 0, FLAP.bodyW, top - FLAP.wick, BODY_RADIUS);
    ctx.fill();
    ctx.fillStyle = ink.up;
    ctx.fillRect(x - WICK_W / HALF, bottom, WICK_W, FLAP.wick);
    ctx.beginPath();
    ctx.roundRect(x - FLAP.bodyW / HALF, bottom + FLAP.wick, FLAP.bodyW, FIELD_H - bottom - FLAP.wick, BODY_RADIUS);
    ctx.fill();
  }
  const y = (s.birdYPrev + (s.birdY - s.birdYPrev) * alpha) * FIELD_H;
  ctx.fillStyle = s.dying ? ink.down : ink.pip;
  ctx.beginPath();
  ctx.arc(FLAP.birdX + s.birdOffsetX, y, BIRD_RADIUS, 0, FULL_TURN);
  ctx.fill();
  hud(ctx, ink, `${s.score}`, null);
}

function hud(ctx: CanvasRenderingContext2D, ink: ArcadeInk, score: string, sub: string | null): void {
  ctx.fillStyle = ink.text;
  ctx.font = HUD_FONT;
  ctx.textBaseline = "top";
  ctx.fillText(score, HUD_PAD, HUD_PAD);
  if (sub) {
    ctx.font = SMALL_FONT;
    ctx.fillText(sub, HUD_PAD, HUD_PAD + HUD_PAD + SMALL_GAP);
  }
}
