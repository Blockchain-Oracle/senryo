import { type ArcadeGame, FIELD_W, MAX_RUN_TICKS, msToTicks, STEP_HZ, TARGET_Q_MAX } from "./field.ts";
import { FLAP, FLAP_MAX_SPEED } from "./flap.ts";
import { RIDE } from "./ride.ts";

/**
 * A run on the wire: the inputs, by tick (S8.8, D-295; Owarine trace.ts). A ride trace is a flat list of
 * `tick, targetQ` pairs (the wheel's byte where it changed, so holding still costs nothing); a hop trace is the ticks
 * pressed. The envelope is the cheap refusal before the replay: a score no run of that length could reach, inputs after
 * the run ended, a shape that is not a trace. A score inside the envelope is still accepted only once the replay
 * reproduces it.
 */
export type RideTrace = readonly number[];
export type FlapTrace = readonly number[];
export type ArcadeTrace = RideTrace | FlapTrace;

const RIDE_PAIR = 2;
const HALF = 2;
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

/** null when the trace is well formed, else the first thing wrong with it. */
export function validateRideTrace(trace: unknown): string | null {
  if (!Array.isArray(trace)) return "a ride trace is an array";
  if (trace.length % RIDE_PAIR !== 0) return "a ride trace is tick, target pairs";
  if (trace.length > MAX_RUN_TICKS * RIDE_PAIR) return "the trace is longer than any run can be";
  let lastTick = -1;
  for (let i = 0; i < trace.length; i += RIDE_PAIR) {
    const tick = trace[i];
    const q = trace[i + 1];
    if (!isInt(tick) || tick < 0) return "a tick is a non-negative integer";
    if (tick <= lastTick) return "ticks rise strictly";
    if (!isInt(q) || q < 0 || q > TARGET_Q_MAX) return `a target is an integer 0..${TARGET_Q_MAX}`;
    lastTick = tick;
  }
  return null;
}

export function validateFlapTrace(trace: unknown): string | null {
  if (!Array.isArray(trace)) return "a hop trace is an array";
  if (trace.length > MAX_RUN_TICKS) return "the trace is longer than any run can be";
  let lastTick = -1;
  for (const tick of trace) {
    if (!isInt(tick) || tick < 0) return "a tick is a non-negative integer";
    if (tick <= lastTick) return "ticks rise strictly";
    lastTick = tick;
  }
  return null;
}

export const validateTrace = (game: ArcadeGame, trace: unknown): string | null =>
  game === "line-rider" ? validateRideTrace(trace) : validateFlapTrace(trace);

function lastTickOf(trace: ArcadeTrace, game: ArcadeGame): number {
  if (trace.length === 0) return -1;
  return game === "line-rider" ? (trace[trace.length - RIDE_PAIR] as number) : (trace[trace.length - 1] as number);
}

/** The most a ride can score in `sec` seconds hugging dead centre every tick (the multiplier grows at most linearly). */
export function rideScoreCeiling(sec: number): number {
  const gain = RIDE.multRamp + RIDE.multHug;
  return Math.ceil(RIDE.baseRate * (sec + (gain * sec * sec) / HALF)) + 1;
}

/** Field units from the first candle's spawn until its body has passed the flyer: no hop scores before then. */
const FIELD_RUNWAY = FIELD_W + FIELD_W * FLAP.leadFrac - FLAP.birdX + FLAP.bodyW / HALF;

/** The most a hop can score in `sec` seconds: nothing on the runway, then one candle per spacing at the top speed. */
export function flapScoreCeiling(sec: number): number {
  const flying = sec - FIELD_RUNWAY / FLAP_MAX_SPEED;
  if (flying <= 0) return 0;
  return Math.ceil((flying * FLAP_MAX_SPEED) / FLAP.spacing1) + 1;
}

export type EnvelopeVerdict = { ok: true; ticks: number } | { ok: false; why: string };

/** The cheap refusal: shape, length, inputs after the end, and a score past what the clock allows. */
export function envelopeCheck(game: ArcadeGame, durationMs: number, trace: unknown, score: number): EnvelopeVerdict {
  const shape = validateTrace(game, trace);
  if (shape) return { ok: false, why: shape };
  if (!Number.isInteger(durationMs) || durationMs <= 0) return { ok: false, why: "a run has a positive length" };
  if (!Number.isInteger(score) || score < 0) return { ok: false, why: "a score is a non-negative integer" };
  const ticks = msToTicks(durationMs);
  if (ticks > MAX_RUN_TICKS) return { ok: false, why: "the run is longer than the replay budget" };
  if (lastTickOf(trace as ArcadeTrace, game) >= ticks) return { ok: false, why: "the trace has inputs after the end" };
  const sec = ticks / STEP_HZ;
  const ceiling = game === "line-rider" ? rideScoreCeiling(sec) : flapScoreCeiling(sec);
  if (score > ceiling) return { ok: false, why: "no run of that length can score that" };
  return { ok: true, ticks };
}

/** The recorder's one rule for the ride: a pair only when the byte changes, so a still wheel writes nothing. */
export function recordRideInput(trace: number[], tick: number, targetQ: number): void {
  const n = trace.length;
  if (n === 0 || trace[n - 1] !== targetQ) trace.push(tick, targetQ);
}
