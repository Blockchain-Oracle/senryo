import { type ArcadeRunConfig, clamp, clamp01, FIELD_H, FIELD_W, lerp, STEP_SEC } from "./field.ts";
import type { Rng } from "./rng.ts";

/**
 * Candle Hop v2 — a coin through a candle canyon (R7.3, D-318, research 10 §3). Candles scroll in from the right in
 * pairs, one a minute of the server's price tape: the gap between them follows the price (a rising minute lifts it), a
 * pair is green or coral by that minute's move, and a big move grows long wicks that poke into the gap. A press kicks
 * the coin up; gravity pulls it down. A body or a wick ends the run after a short fall; the floor too; the ceiling only
 * bonks. Each candle passed is a point. The gap narrows (120 → 88 px) and the canyon speeds up as the run goes.
 *
 * Deterministic on every engine (field.ts): + − × ÷, min, max, abs, floor only — collision is a circle against
 * rectangles by squared distance, no square root. A run is its seed, its tape and the ticks pressed.
 */
export const FLAP_ENGINE_VERSION = 2;

interface FlapTuning {
  rampSec: number;
  speed0: number;
  speed1: number;
  gap1: number;
}

const FULL: FlapTuning = { rampSec: 50, speed0: 150, speed1: 205, gap1: 88 };
/** The calmer ramp: a slower canyon and a gap that never closes as far. */
const CALM: FlapTuning = { rampSec: 80, speed0: 135, speed1: 175, gap1: 100 };
/** The fastest the canyon ever moves, in either tuning: the envelope's bound on candles per second. */
export const FLAP_MAX_SPEED = FULL.speed1;

export const FLAP = {
  /** The coin sits here (field px); its drawn radius and the forgiving hit radius inside it. */
  coinX: 180,
  coinR: 12,
  hitR: 9,
  /** px/s², the kick every press gives (px/s), and the fall's cap. */
  gravity: 1000,
  flapV: -310,
  vyMax: 520,
  spacing0: 200,
  spacing1: 170,
  bodyW: 30,
  wickW: 3,
  /** The full gap between the bodies, early; the late value is the tuning's. */
  gap0: 120,
  /** The gap keeps this far from the ceiling and the floor. */
  edge: 34,
  /** The gap's centre: the tape's mean move is `movePx` at 1× (2× late), at most `stepMax` a candle, pulled home. */
  movePx: 22,
  lev1: 2,
  stepMax: 90,
  centerPull: 0.08,
  /** A near-flat tape is not blown up past this mean move (tenths of a basis point). */
  moveFloor: 5,
  /** A wick pokes this far into the gap at a typical move, never past `wickMax`; the gap left is at least `pass`. */
  wickPx: 8,
  wickMax: 26,
  pass: 48,
  /** A short runway before the first candle. */
  leadFrac: 0.12,
  deathGravity: 1400,
  deathVyMax: 900,
  deathMinSec: 0.5,
  deathMaxSec: 0.9,
  /** The fall's backward drift (px/s) and how long it takes to die away. */
  deathDrift: 52,
  deathDriftSec: 0.48,
  deathKick: -80,
  /** A candle is a full impact; the floor a softer one (the draw's shake and flash scale with it). */
  floorImpact: 0.72,
  candleImpact: 1,
  startY: 150,
} as const;

export interface Candle {
  /** Centre x in field px; scrolls left. */
  x: number;
  /** The gap's centre and half-height (px), and how far each wick pokes into it. */
  center: number;
  half: number;
  wickTop: number;
  wickBottom: number;
  /** The minute's move: up (green) or down (coral). */
  up: boolean;
  scored: boolean;
}

export interface FlapImpact {
  x: number;
  y: number;
  strength: number;
}

export interface FlapState {
  tick: number;
  elapsedSec: number;
  over: boolean;
  dying: boolean;
  deathElapsedSec: number;
  /** The coin's height (px, down) and speed (px/s). */
  coinY: number;
  coinYPrev: number;
  vy: number;
  coinOffsetX: number;
  coinOffsetXPrev: number;
  worldX: number;
  worldXPrev: number;
  score: number;
  candles: Candle[];
  spawnX: number;
  /** The tape's cursor and the minute the run starts at (the seed picks it), the gap's centre path, and px per tape
   * unit at 1×. */
  laid: number;
  tapeStart: number;
  center: number;
  tapeScale: number;
  difficulty: number;
  speed: number;
  /** Events of the last step. */
  flapped: boolean;
  scored: boolean;
  crashed: boolean;
  impact: FlapImpact | null;
}

const tuning = (config: ArcadeRunConfig): FlapTuning => (config.calm ? CALM : FULL);
const spacingOf = (d: number) => lerp(FLAP.spacing0, FLAP.spacing1, d);
const HALF = 0.5;

function meanMove(tape: readonly number[]): number {
  let sum = 0;
  for (const m of tape) sum += Math.abs(m);
  return Math.max(FLAP.moveFloor, tape.length === 0 ? 0 : sum / tape.length);
}

/** The next pair: the gap follows the tape's next minute, its wicks grow with the size of the move. */
function nextCandle(s: FlapState, rng: Rng, d: number, t: FlapTuning, config: ArcadeRunConfig): Candle {
  const tape = config.tape;
  const move = tape.length === 0 ? 0 : (tape[(s.tapeStart + s.laid) % tape.length] as number);
  s.laid += 1;
  const half = lerp(FLAP.gap0, t.gap1, d) * HALF;
  const mid = FIELD_H * HALF;
  // A rising minute lifts the gap (y grows down); a little seeded wobble keeps a flat tape alive.
  let step = -move * s.tapeScale * lerp(1, FLAP.lev1, d) + (rng.next() * 2 - 1) * FLAP.wickPx;
  step = clamp(step, -FLAP.stepMax, FLAP.stepMax);
  s.center = clamp(s.center + step + (mid - s.center) * FLAP.centerPull, FLAP.edge + half, FIELD_H - FLAP.edge - half);
  const size = Math.abs(move) / meanMove(tape);
  const room = Math.max(0, half * 2 - FLAP.pass);
  const wick = Math.min(FLAP.wickMax, FLAP.wickPx * size, room * HALF);
  // The wick on the side the price moved toward is the long one.
  const up = move >= 0;
  return {
    x: s.spawnX,
    center: s.center,
    half,
    wickTop: up ? wick : wick * HALF,
    wickBottom: up ? wick * HALF : wick,
    up,
    scored: false,
  };
}

/** Keep candles queued out to just past the right edge. */
function fill(s: FlapState, rng: Rng, d: number, t: FlapTuning, config: ArcadeRunConfig): void {
  while (s.spawnX < FIELD_W + spacingOf(d)) {
    s.candles.push(nextCandle(s, rng, d, t, config));
    s.spawnX += spacingOf(d);
  }
}

/** A run at tick zero. Pressing play is also the first flap, so the run answers the first press. */
export function createFlapState(rng: Rng, config: ArcadeRunConfig): FlapState {
  const s: FlapState = {
    tick: 0,
    elapsedSec: 0,
    over: false,
    dying: false,
    deathElapsedSec: 0,
    coinY: FLAP.startY,
    coinYPrev: FLAP.startY,
    vy: FLAP.flapV,
    coinOffsetX: 0,
    coinOffsetXPrev: 0,
    worldX: 0,
    worldXPrev: 0,
    score: 0,
    candles: [],
    spawnX: FIELD_W + FIELD_W * FLAP.leadFrac,
    laid: 0,
    tapeStart: Math.floor(rng.next() * config.tape.length),
    center: FIELD_H * HALF,
    tapeScale: FLAP.movePx / meanMove(config.tape),
    difficulty: 0,
    speed: tuning(config).speed0,
    flapped: false,
    scored: false,
    crashed: false,
    impact: null,
  };
  fill(s, rng, 0, tuning(config), config);
  return s;
}

function beginDeath(s: FlapState, x: number, y: number, strength: number): void {
  s.dying = true;
  s.deathElapsedSec = 0;
  s.impact = { x, y, strength };
  s.crashed = true;
  s.coinOffsetX = 0;
  s.vy = FLAP.deathKick;
}

function stepDeath(s: FlapState): void {
  const dt = STEP_SEC;
  s.deathElapsedSec += dt;
  s.vy = Math.min(FLAP.deathVyMax, s.vy + FLAP.deathGravity * dt);
  s.coinY += s.vy * dt;
  s.coinOffsetX -= Math.max(0, FLAP.deathDrift * (1 - s.deathElapsedSec / FLAP.deathDriftSec)) * dt;
  const fallenOut = s.coinY - FLAP.coinR > FIELD_H;
  if ((s.deathElapsedSec >= FLAP.deathMinSec && fallenOut) || s.deathElapsedSec >= FLAP.deathMaxSec) {
    s.over = true;
    s.dying = false;
  }
}

/** Whether a circle at (cx, cy) with radius r touches the rectangle — by squared distance, no root. */
function touches(cx: number, cy: number, r: number, x0: number, y0: number, x1: number, y1: number): boolean {
  if (y1 <= y0) return false;
  const dx = cx - clamp(cx, x0, x1);
  const dy = cy - clamp(cy, y0, y1);
  return dx * dx + dy * dy < r * r;
}

/** The candle the coin touched, as the impact's point, or null. */
function hitOf(s: FlapState): { x: number; y: number } | null {
  const cx = FLAP.coinX;
  const cy = s.coinY;
  const r = FLAP.hitR;
  const bw = FLAP.bodyW * HALF;
  const ww = FLAP.wickW * HALF;
  for (const c of s.candles) {
    if (Math.abs(c.x - cx) > bw + r) continue;
    const top = c.center - c.half;
    const bottom = c.center + c.half;
    if (touches(cx, cy, r, c.x - bw, 0, c.x + bw, top)) return { x: c.x - bw, y: top };
    if (touches(cx, cy, r, c.x - ww, top, c.x + ww, top + c.wickTop)) return { x: c.x, y: top + c.wickTop };
    if (touches(cx, cy, r, c.x - bw, bottom, c.x + bw, FIELD_H)) return { x: c.x - bw, y: bottom };
    if (touches(cx, cy, r, c.x - ww, bottom - c.wickBottom, c.x + ww, bottom))
      return { x: c.x, y: bottom - c.wickBottom };
  }
  return null;
}

/** One 60 Hz step, with or without a press. Mutates in place; a finished run ignores further steps. */
export function stepFlap(s: FlapState, flap: boolean, rng: Rng, config: ArcadeRunConfig): void {
  if (s.over) return;
  const t = tuning(config);
  const dt = STEP_SEC;
  s.flapped = false;
  s.scored = false;
  s.crashed = false;
  s.coinYPrev = s.coinY;
  s.coinOffsetXPrev = s.coinOffsetX;
  s.worldXPrev = s.worldX;
  s.tick += 1;
  if (s.dying) {
    stepDeath(s);
    return;
  }
  if (flap) {
    s.vy = FLAP.flapV;
    s.flapped = true;
  }
  s.elapsedSec += dt;
  const d = clamp01(s.elapsedSec / t.rampSec);
  s.difficulty = d;
  s.speed = lerp(t.speed0, t.speed1, d);
  s.vy = Math.min(FLAP.vyMax, s.vy + FLAP.gravity * dt);
  s.coinY += s.vy * dt;
  s.worldX += s.speed * dt;
  s.spawnX -= s.speed * dt;
  for (const c of s.candles) c.x -= s.speed * dt;
  while (s.candles.length > 0 && (s.candles[0] as Candle).x < -FLAP.bodyW) s.candles.shift();
  fill(s, rng, d, t, config);

  // A candle whose body has fully passed the coin is a point.
  for (const c of s.candles) {
    if (!c.scored && c.x + FLAP.bodyW * HALF < FLAP.coinX - FLAP.hitR) {
      c.scored = true;
      s.score += 1;
      s.scored = true;
    }
  }
  // The ceiling clamps (a forgiving bonk); the floor, the bodies and the wicks are fatal.
  if (s.coinY < FLAP.hitR) {
    s.coinY = FLAP.hitR;
    s.vy = 0;
  }
  if (s.coinY > FIELD_H - FLAP.hitR) {
    beginDeath(s, FLAP.coinX, FIELD_H - 1, FLAP.floorImpact);
    return;
  }
  const hit = hitOf(s);
  if (hit) beginDeath(s, hit.x, hit.y, FLAP.candleImpact);
}
