import { type ArcadeGame, type ArcadeRunConfig, MAX_RUN_TICKS } from "./field.ts";
import { createFlapState, stepFlap } from "./flap.ts";
import { createRideState, RIDE_START_Q, rideScoreOf, stepRide } from "./ride.ts";
import { createRng } from "./rng.ts";
import type { FlapTrace, RideTrace } from "./trace.ts";

/**
 * A run played again from its seed and inputs: the server's whole check (S8.8, D-295; Owarine replay.ts). A run that
 * ends where the device said, on the score it said, is a run that happened. It does not prove a person played (nothing
 * on a device can), which is why the board says "checked · not on chain" and no money rides on these scores. After the
 * last recorded input the wheel holds and the button is silent, so a replay always finishes; one still running at the
 * budget is refused.
 */
export interface ReplayResult {
  score: number;
  ticks: number;
  /** False when the run hadn't ended by the replay budget: never a score to accept. */
  ended: boolean;
}

const RIDE_PAIR = 2;

export function replayRide(seed: string, trace: RideTrace, config: ArcadeRunConfig): ReplayResult {
  const rng = createRng(seed);
  const state = createRideState(rng, config);
  let cursor = 0;
  let targetQ = RIDE_START_Q;
  while (!state.over && state.tick < MAX_RUN_TICKS) {
    while (cursor < trace.length && (trace[cursor] as number) === state.tick) {
      targetQ = trace[cursor + 1] as number;
      cursor += RIDE_PAIR;
    }
    stepRide(state, targetQ, rng, config);
  }
  return { score: rideScoreOf(state), ticks: state.tick, ended: state.over };
}

export function replayFlap(seed: string, trace: FlapTrace, config: ArcadeRunConfig): ReplayResult {
  const rng = createRng(seed);
  const state = createFlapState(rng, config);
  let cursor = 0;
  while (!state.over && state.tick < MAX_RUN_TICKS) {
    let flap = false;
    while (cursor < trace.length && (trace[cursor] as number) === state.tick) {
      flap = true;
      cursor += 1;
    }
    stepFlap(state, flap, rng, config);
  }
  return { score: state.score, ticks: state.tick, ended: state.over };
}

export function replayArcade(
  game: ArcadeGame,
  seed: string,
  trace: readonly number[],
  config: ArcadeRunConfig,
): ReplayResult {
  return game === "line-rider" ? replayRide(seed, trace, config) : replayFlap(seed, trace, config);
}
