/**
 * One arcade run as the stage sees it (R7.1): a loop driver (fixed steps, interpolated draws) that takes the player's
 * input, records the trace the server replays, and reports its HUD and its end. Line Rider's sled and Candle Hop's coin
 * both fit it, so the stage — full screen, countdown, pause, game over — is one.
 */
import type { LoopDriver } from "./canvas.ts";

/** Held anywhere (a pointer, Space or ↑) and which way to lean (the screen's half, ← or →). */
export interface RunInput {
  hold: boolean;
  lean: -1 | 0 | 1;
}

export interface RunHud {
  score: number;
  /** The combo multiplier when the game has one. */
  combo: number | null;
  /** What's under the player: the market and moment the sled is riding. */
  line: string | null;
}

export interface RunStat {
  label: string;
  value: string;
}

export interface ArcadeRun extends LoopDriver {
  readonly seed: string;
  readonly ranked: boolean;
  readonly calm: boolean;
  isOver(): boolean;
  score(): number;
  ticks(): number;
  trace(): number[];
  input(next: RunInput): void;
  /** How the game plays itself (a page's attract loop): the input a steady player would give now. */
  autopilot(): RunInput;
  hud(): RunHud;
  stats(): RunStat[];
}

const SEC_PER_MIN = 60;
const PAD = 2;

/** m:ss of a run's length. */
export function clockOf(sec: number): string {
  const s = Math.floor(sec);
  return `${Math.floor(s / SEC_PER_MIN)}:${String(s % SEC_PER_MIN).padStart(PAD, "0")}`;
}
