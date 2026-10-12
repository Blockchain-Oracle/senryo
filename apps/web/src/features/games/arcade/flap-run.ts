/**
 * Candle Hop v2 on the stage (R7.3): a coin through the candle canyon as the stage's driver. A press is a flap
 * (recorded by tick for the replay) with the wing; the coin squashes on the kick and stretches as it falls; each candle
 * passed rises a note and throws sparks; a crash is 50 ms of hit-stop, an 8 px shake over 300 ms, fragments, a flash,
 * the heavy haptic and the music cut. The 640×360 canyon is letterboxed into the stage; the draw never steers the run.
 */
import {
  type Candle,
  createFlapState,
  createRng,
  FIELD_H,
  FIELD_W,
  FLAP,
  type FlapState,
  STEP_HZ,
  stepFlap,
} from "@senryo/core";
import { fire, music } from "@/lib/feedback";
import { type ArcadeInk, tint } from "./ink";
import type { ArcadeView } from "./loop";
import { type ArcadeRun, clockOf } from "./run";

const LOOK = {
  bodyRadius: 4,
  coinGlow: 16,
  rim: 2,
  hitStopTicks: 3,
  crashShake: 8,
  shakeKeep: 0.86,
  flashKeep: 0.9,
  flashAlpha: 0.35,
  flashFloor: 0.02,
  squash: 0.28,
  stretchPerSpeed: 0.0006,
  stretchMax: 0.25,
  squashKeep: 0.8,
  gravity: 900,
  bits: 26,
  sparks: 10,
  bitLife: 40,
  sparkLife: 22,
  burst: 240,
  sparkSpeed: 160,
  bitSize: 3,
  sparkSize: 2,
  streakAt: 10,
} as const;

const HALF = 0.5;
const TWO = 2;
const FULL_TURN = Math.PI * TWO;

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

const rand = (spread: number) => (Math.random() * TWO - 1) * spread;

function drawCandle(ctx: CanvasRenderingContext2D, c: Candle, x: number, ink: ArcadeInk): void {
  const color = c.up ? ink.up : ink.down;
  const top = c.center - c.half;
  const bottom = c.center + c.half;
  const bw = FLAP.bodyW;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x - bw * HALF, -LOOK.bodyRadius, bw, top + LOOK.bodyRadius, LOOK.bodyRadius);
  ctx.roundRect(x - bw * HALF, bottom, bw, FIELD_H - bottom + LOOK.bodyRadius, LOOK.bodyRadius);
  ctx.fill();
  ctx.fillStyle = tint(ink.arena, HALF);
  ctx.fillRect(x + bw * HALF - LOOK.rim * TWO, 0, LOOK.rim * TWO, top);
  ctx.fillRect(x + bw * HALF - LOOK.rim * TWO, bottom, LOOK.rim * TWO, FIELD_H - bottom);
  // The wicks poke into the gap, lit.
  ctx.shadowBlur = LOOK.coinGlow * HALF;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.fillRect(x - FLAP.wickW * HALF, top, FLAP.wickW, c.wickTop);
  ctx.fillRect(x - FLAP.wickW * HALF, bottom - c.wickBottom, FLAP.wickW, c.wickBottom);
  ctx.shadowBlur = 0;
}

export function createFlapRun(o: {
  seed: string;
  ranked: boolean;
  calm: boolean;
  tape: { symbol: string; moves: readonly number[] };
  ink: ArcadeInk;
}): ArcadeRun {
  const rng = createRng(o.seed);
  const config = { calm: o.calm, tape: o.tape.moves };
  const s: FlapState = createFlapState(rng, config);
  const ink = o.ink;
  const trace: number[] = [];
  const still = o.calm;
  let pressed = false;
  let held = false;
  let shake = 0;
  let flash = 0;
  let hitStop = 0;
  let squash = 0;
  let bits: Bit[] = [];

  const burst = (x: number, y: number, n: number, speed: number, color: string, life: number, size: number) => {
    for (let i = 0; i < n; i++) bits.push({ x, y, vx: rand(speed), vy: rand(speed), life, max: life, color, size });
  };

  const step = () => {
    shake *= LOOK.shakeKeep;
    flash *= LOOK.flashKeep;
    squash *= LOOK.squashKeep;
    const dt = 1 / STEP_HZ;
    bits = bits.filter((b) => {
      b.vy += LOOK.gravity * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= 1;
      return b.life > 0;
    });
    if (s.over) return;
    if (hitStop > 0) {
      hitStop -= 1;
      return;
    }
    const flap = pressed;
    pressed = false;
    if (flap) trace.push(s.tick);
    stepFlap(s, flap, rng, config);
    if (s.flapped) {
      squash = 1;
      fire("tick", { cue: "wing" });
    }
    if (s.scored) {
      fire(s.score % LOOK.streakAt === 0 ? "confirm" : "snap", { ladder: ["gap", s.score - 1] });
      burst(FLAP.coinX, s.coinY, LOOK.sparks, LOOK.sparkSpeed, ink.up, LOOK.sparkLife, LOOK.sparkSize);
    }
    if (s.crashed && s.impact) {
      hitStop = LOOK.hitStopTicks;
      shake = still ? 0 : LOOK.crashShake * s.impact.strength;
      flash = still ? 0 : 1;
      burst(FLAP.coinX, s.coinY, LOOK.bits, LOOK.burst, ink.accent, LOOK.bitLife, LOOK.bitSize);
      burst(s.impact.x, s.impact.y, LOOK.sparks, LOOK.burst, ink.ink, LOOK.bitLife, LOOK.bitSize);
      fire("impact", { cue: "crash" });
      music(null);
    }
  };

  const draw = (view: ArcadeView, alpha: number) => {
    const { ctx, w, h, dpr } = view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = ink.arena;
    ctx.fillRect(0, 0, w, h);
    const k = Math.min(w / FIELD_W, h / FIELD_H);
    const ox = (w - FIELD_W * k) * HALF + rand(shake);
    const oy = (h - FIELD_H * k) * HALF + rand(shake);
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * oy);
    const sky = ctx.createLinearGradient(0, 0, 0, FIELD_H);
    sky.addColorStop(0, ink.raised);
    sky.addColorStop(1, ink.arena);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    const shift = (s.worldX - s.worldXPrev) * (1 - alpha);
    for (const c of s.candles) drawCandle(ctx, c, c.x + shift, ink);
    // The coin: squashed by a kick, stretched by a fall.
    const y = s.coinYPrev + (s.coinY - s.coinYPrev) * alpha;
    const x = FLAP.coinX + s.coinOffsetXPrev + (s.coinOffsetX - s.coinOffsetXPrev) * alpha;
    const stretch = Math.min(LOOK.stretchMax, Math.max(0, s.vy) * LOOK.stretchPerSpeed) - squash * LOOK.squash;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1 - stretch * HALF, 1 + stretch);
    ctx.shadowBlur = LOOK.coinGlow;
    ctx.shadowColor = ink.accent;
    ctx.fillStyle = s.dying ? ink.down : ink.accent;
    ctx.beginPath();
    ctx.arc(0, 0, FLAP.coinR, 0, FULL_TURN);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = tint(ink.ink, HALF);
    ctx.lineWidth = LOOK.rim;
    ctx.beginPath();
    ctx.arc(0, 0, FLAP.coinR - LOOK.rim * TWO, 0, FULL_TURN);
    ctx.stroke();
    ctx.restore();
    for (const b of bits) {
      ctx.fillStyle = tint(b.color, b.life / b.max);
      ctx.fillRect(b.x - b.size * HALF, b.y - b.size * HALF, b.size, b.size);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (flash > LOOK.flashFloor) {
      ctx.fillStyle = tint(ink.down, flash * LOOK.flashAlpha);
      ctx.fillRect(0, 0, w, h);
    }
  };

  return {
    seed: o.seed,
    ranked: o.ranked,
    calm: o.calm,
    step,
    draw,
    isOver: () => s.over,
    score: () => s.score,
    ticks: () => s.tick,
    trace: () => trace,
    input: (next) => {
      if (next.hold && !held) pressed = true;
      held = next.hold;
    },
    hud: () => ({ score: s.score, combo: null, line: `${o.tape.symbol} · the last day's candles` }),
    stats: () => [
      { label: "Time", value: clockOf(s.tick / STEP_HZ) },
      { label: "Candles", value: String(s.score) },
    ],
  };
}
