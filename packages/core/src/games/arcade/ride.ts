import { type ArcadeRunConfig, clamp, clamp01, FIELD_W, lerp, STEP_SEC, TARGET_Q_MAX } from "./field.ts";
import type { Rng } from "./rng.ts";

/**
 * Line Rider's mechanics as a pure step over a state (S8.8, D-295; Owarine packages/core/src/games/arcade/ride.ts): a
 * line scrolls in from the right and the player rides a pip on it. Hug the line and the score climbs (faster the
 * tighter the hug, through a combo multiplier) and grip refills; drift off and the combo decays while grip drains;
 * grip empty, run over. Speed and the tolerance tighten after a warm-up, and past the ramp the speed keeps creeping so
 * every run eventually breaks. The only input is one byte a tick (where the wheel is); every draw is seeded.
 */
export const RIDE_ENGINE_VERSION = 1;

interface RideTuning {
  warmupSec: number;
  rampSec: number;
  speed0: number;
  speed1: number;
  speedCreep: number;
  drain0: number;
  drain1: number;
  drainCreep: number;
}

const FULL: RideTuning = {
  warmupSec: 2,
  rampSec: 34,
  speed0: 95,
  speed1: 360,
  speedCreep: 6,
  drain0: 0.4,
  drain1: 1.5,
  drainCreep: 0.02,
};
/** The calmer ramp: the climb to full difficulty nearly twice as long, a gentler ceiling. */
const CALM: RideTuning = {
  warmupSec: 3,
  rampSec: 60,
  speed0: 90,
  speed1: 300,
  speedCreep: 4,
  drain0: 0.35,
  drain1: 1.1,
  drainCreep: 0.015,
};

const SEG_PX = 12;
const READ_AHEAD_POINTS = 4;

export const RIDE = {
  /** The pip sits here (field units); the line flows in from the right, which is the future. */
  pipX: 204.8,
  /** The line stays inside this band, normalised to the field's height. */
  yMin: 0.16,
  yMax: 0.84,
  /** Wheel 0 puts the pip near the floor, wheel 1 near the ceiling. */
  pipLo: 0.92,
  pipHi: 0.08,
  segPx: SEG_PX,
  /** On-line tolerance, a half-band of the height: generous early, tight late. */
  band0: 0.08,
  band1: 0.04,
  pipTrack: 16,
  baseRate: 34,
  multRamp: 0.55,
  multHug: 1.5,
  multDecay: 9,
  gripRefill: 0.26,
  graceSec: 0.12,
  points: Math.ceil(FIELD_W / SEG_PX) + READ_AHEAD_POINTS,
} as const;

/** How the line is drawn: goals rerolled more often and farther as difficulty rises, rare sharp spikes late. */
const LINE = {
  spikeFrom: 0.35,
  spikeBase: 0.05,
  spikeGain: 0.12,
  span0: 0.16,
  span1: 0.52,
  spikeSpan: 1.7,
  segs0: 16,
  segs1: 3.2,
  spikeSegs: 0.35,
  jitterMin: 0.6,
  jitterSpan: 0.8,
  minSegs: 2,
  ease0: 0.09,
  ease1: 0.3,
  flatOpening: 30,
  midline: 0.5,
  hugFloor: 0.5,
} as const;

export interface RideState {
  tick: number;
  elapsedSec: number;
  over: boolean;
  /** The wheel, 0..1, as last set. */
  target: number;
  pipY: number;
  pipYPrev: number;
  worldX: number;
  worldXPrev: number;
  /** World index of `pts[0]`; the line is a ring of normalised y values that scrolls left. */
  head: number;
  pts: number[];
  genCur: number;
  genGoal: number;
  segsToGoal: number;
  score: number;
  mult: number;
  grip: number;
  onLine: boolean;
  offForSec: number;
  onForSec: number;
  milestone: number;
  /** How far the ramp has run, 0..1, and the speed and band it gives (for the draw and the sounds). */
  difficulty: number;
  speed: number;
  band: number;
  /** Events of the last step: the pip found the line again; the combo crossed a whole number. */
  regained: boolean;
  milestoneHit: number;
}

const tuning = (config: ArcadeRunConfig): RideTuning => (config.calm ? CALM : FULL);
const difficultyOf = (elapsedSec: number, t: RideTuning) => clamp01((elapsedSec - t.warmupSec) / t.rampSec);
/** Seconds past full difficulty: the endless escalation that eventually breaks a run. */
const overrunOf = (elapsedSec: number, t: RideTuning) => Math.max(0, elapsedSec - t.warmupSec - t.rampSec);

/** The next line point. The generator is drawn in a fixed order and only here, so a seed fixes the line. */
function nextY(state: RideState, rng: Rng, d: number): number {
  if (state.segsToGoal <= 0) {
    const spike = d > LINE.spikeFrom && rng.next() < LINE.spikeBase + d * LINE.spikeGain;
    const span = lerp(LINE.span0, LINE.span1, d) * (spike ? LINE.spikeSpan : 1);
    const lo = Math.max(RIDE.yMin, state.genCur - span);
    const hi = Math.min(RIDE.yMax, state.genCur + span);
    state.genGoal = lo + rng.next() * (hi - lo);
    const base = lerp(LINE.segs0, LINE.segs1, d);
    const jitter = LINE.jitterMin + rng.next() * LINE.jitterSpan;
    state.segsToGoal = Math.max(LINE.minSegs, Math.round((spike ? base * LINE.spikeSegs : base) * jitter));
  }
  state.segsToGoal -= 1;
  state.genCur += (state.genGoal - state.genCur) * lerp(LINE.ease0, LINE.ease1, d);
  return clamp(state.genCur, RIDE.yMin, RIDE.yMax);
}

function fill(state: RideState, rng: Rng, d: number): void {
  while (state.pts.length < RIDE.points) state.pts.push(nextY(state, rng, d));
}

/** The line's normalised y at a field x; the draw passes its own interpolated `worldX` for smooth motion. */
export function rideLineYAt(state: RideState, x: number, worldX = state.worldX): number {
  const worldPos = (worldX + x) / RIDE.segPx;
  const i = Math.floor(worldPos - state.head);
  const last = state.pts.length - 1;
  if (i < 0 || i >= last) return state.pts[clamp(i, 0, last)] ?? LINE.midline;
  const f = worldPos - state.head - i;
  return lerp(state.pts[i] as number, state.pts[i + 1] as number, f);
}

export const targetFromQ = (targetQ: number): number => clamp(targetQ, 0, TARGET_Q_MAX) / TARGET_Q_MAX;
export const qFromTarget = (target: number): number => Math.round(clamp01(target) * TARGET_Q_MAX);

/** Every run opens with the wheel centred, on the device and on the server alike. */
export const RIDE_START_Q = Math.round(TARGET_Q_MAX / 2);

/** A run at tick zero: the line opens flat where the pip sits, so a run never begins with a free death. */
export function createRideState(rng: Rng, config: ArcadeRunConfig): RideState {
  const t = tuning(config);
  const target = targetFromQ(RIDE_START_Q);
  const startY = clamp(lerp(RIDE.pipLo, RIDE.pipHi, target), RIDE.yMin, RIDE.yMax);
  const state: RideState = {
    tick: 0,
    elapsedSec: 0,
    over: false,
    target,
    pipY: startY,
    pipYPrev: startY,
    worldX: 0,
    worldXPrev: 0,
    head: 0,
    pts: [],
    genCur: startY,
    genGoal: startY,
    segsToGoal: LINE.flatOpening,
    score: 0,
    mult: 1,
    grip: 1,
    onLine: true,
    offForSec: 0,
    onForSec: 0,
    milestone: 1,
    difficulty: 0,
    speed: t.speed0,
    band: RIDE.band0,
    regained: false,
    milestoneHit: 0,
  };
  fill(state, rng, 0);
  return state;
}

/** One 60 Hz step with the wheel at `targetQ`. Mutates in place; a finished run ignores further steps. */
export function stepRide(state: RideState, targetQ: number, rng: Rng, config: ArcadeRunConfig): void {
  if (state.over) return;
  const t = tuning(config);
  const dt = STEP_SEC;
  state.regained = false;
  state.milestoneHit = 0;
  state.target = targetFromQ(targetQ);
  state.pipYPrev = state.pipY;
  state.worldXPrev = state.worldX;

  const d = difficultyOf(state.elapsedSec, t);
  state.elapsedSec += dt;
  state.tick += 1;
  state.difficulty = d;

  // Scroll the world; drop points that left the left edge and generate to the right.
  const speed = lerp(t.speed0, t.speed1, d) + overrunOf(state.elapsedSec, t) * t.speedCreep;
  state.speed = speed;
  state.worldX += speed * dt;
  while ((state.head + 1) * RIDE.segPx < state.worldX) {
    state.pts.shift();
    state.head += 1;
  }
  fill(state, rng, d);

  // The pip eases toward the wheel.
  const targetY = lerp(RIDE.pipLo, RIDE.pipHi, state.target);
  state.pipY += (targetY - state.pipY) * Math.min(1, dt * RIDE.pipTrack);

  const lineY = rideLineYAt(state, RIDE.pipX);
  const band = lerp(RIDE.band0, RIDE.band1, d);
  state.band = band;
  const dist = Math.abs(state.pipY - lineY);
  const onLine = dist <= band;
  if (onLine && !state.onLine) state.regained = true;
  if (onLine) {
    state.onForSec += dt;
    state.offForSec = 0;
  } else {
    state.offForSec += dt;
    state.onForSec = 0;
  }
  state.onLine = onLine;

  if (onLine) {
    const hug = 1 - clamp01(dist / band);
    state.mult += dt * (RIDE.multRamp + RIDE.multHug * hug);
    state.score += dt * RIDE.baseRate * state.mult * (LINE.hugFloor + (1 - LINE.hugFloor) * hug);
    state.grip = Math.min(1, state.grip + dt * RIDE.gripRefill);
  } else {
    state.mult = Math.max(1, state.mult - dt * RIDE.multDecay);
    // No grip loss through the warm-up: the opening seconds are a free window to find the line.
    if (state.offForSec > RIDE.graceSec && state.elapsedSec > t.warmupSec) {
      state.grip -= dt * (lerp(t.drain0, t.drain1, d) + overrunOf(state.elapsedSec, t) * t.drainCreep);
    }
  }

  const whole = Math.floor(state.mult);
  if (whole > state.milestone) {
    state.milestone = whole;
    state.milestoneHit = whole;
  } else if (state.mult < state.milestone) {
    state.milestone = Math.max(1, Math.floor(state.mult));
  }

  if (state.grip <= 0) {
    state.grip = 0;
    state.over = true;
  }
}

/** The integer a run is scored as, on the HUD and on the board. */
export const rideScoreOf = (state: RideState): number => Math.round(state.score);
