/**
 * The arcade's fixed world (S8.8, D-295; Owarine packages/core/src/games/arcade/field.ts). Both engines simulate a
 * 640×360 field at 60 steps a second, whatever draws them: a run is a seed and a list of inputs by tick, so the same
 * inputs on a phone, a monitor and a server (which has no canvas) produce the same run. Nothing in the simulation calls
 * `Math.sin`, `exp` or `pow` (not required to agree bit for bit across engines): only + − × ÷, min, max, abs, floor,
 * round, which IEEE 754 fixes exactly.
 */
export const FIELD_W = 640;
export const FIELD_H = 360;
export const STEP_HZ = 60;
export const STEP_SEC = 1 / STEP_HZ;
const MS_PER_SEC = 1_000;
export const STEP_MS = MS_PER_SEC / STEP_HZ;

/** The longest run the server replays (thirty minutes); a trace past it is refused. */
export const MAX_RUN_SEC = 1_800;
export const MAX_RUN_TICKS = MAX_RUN_SEC * STEP_HZ;

/** The ride's wheel is one byte a tick in the trace, so the trace is compact and the replay exact. */
export const TARGET_Q_MAX = 255;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export type ArcadeGame = "line-rider" | "candle-hop";
export const ARCADE_GAMES: readonly ArcadeGame[] = ["line-rider", "candle-hop"];

export function isArcadeGame(value: string): value is ArcadeGame {
  return value === "line-rider" || value === "candle-hop";
}

/** Reduced motion offers the calmer ramp; the ramp is the mechanic, so the replay knows and the board says so. */
export interface ArcadeRunConfig {
  calm: boolean;
}

export const ticksToMs = (ticks: number): number => Math.round((ticks * MS_PER_SEC) / STEP_HZ);
export const msToTicks = (ms: number): number => Math.round((ms * STEP_HZ) / MS_PER_SEC);
