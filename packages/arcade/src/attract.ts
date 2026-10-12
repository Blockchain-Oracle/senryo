import type { LoopDriver } from "./canvas.ts";
import type { ArcadeFeel } from "./feel.ts";
import type { ArcadeRun } from "./run.ts";

/**
 * A game playing itself (R7.7, research 10 §3: "show the game itself"): runs made by `make`, each steered by its own
 * autopilot, a new one a beat after each ends — the page's live window into the game, the same engine and drawing
 * as a real run. Silent: the page isn't the game.
 */
const RESTART_TICKS = 90;

export const SILENT: ArcadeFeel = { fire: () => undefined, sound: () => undefined, music: () => undefined };

export function createAttract(make: () => ArcadeRun): LoopDriver {
  let run = make();
  let after = 0;
  return {
    step() {
      if (run.isOver()) {
        after += 1;
        if (after >= RESTART_TICKS) {
          run = make();
          after = 0;
        }
      } else run.input(run.autopilot());
      run.step();
    },
    draw(view, alpha, nowMs) {
      run.draw(view, alpha, nowMs);
    },
  };
}
