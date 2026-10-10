import { monitorEventLoopDelay } from "node:perf_hooks";
import type { Logger } from "./logger.ts";

/**
 * Process-wide guards (04-pricing R1, F1). Node ≥ 15 exits on an unhandled rejection; one forgotten `catch` on a side
 * path (a RedStone poll, an archive lookup) would take every stream and the relay down with it. A listener here keeps
 * the process up, logs the reason and counts it for `/status`. An uncaught exception still exits: after a synchronous
 * throw escaped every frame, the process state can't be trusted, and Coolify restarts the container.
 */
export interface ProcessFaults {
  unhandledRejections: number;
  /** ISO time of the newest unhandled rejection, or null when there has been none. */
  lastRejectionAt: string | null;
  /** The event loop's delay over the last full minute (D-272: p99 ≤ 20 ms); null in the first minute. */
  loopDelayP99Ms: number | null;
  loopDelayMaxMs: number | null;
}

export interface ProcessGuards {
  faults(): ProcessFaults;
}

const EXIT_FAILURE = 1;
const LOOP_RESOLUTION_MS = 10;
const LOOP_WINDOW_MS = 60_000;
const NS_PER_MS = 1e6;
const P99 = 99;

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

/** Install once, as early as possible in a service's `main.ts`. */
export function installProcessGuards(log: Logger): ProcessGuards {
  const state: ProcessFaults = {
    unhandledRejections: 0,
    lastRejectionAt: null,
    loopDelayP99Ms: null,
    loopDelayMaxMs: null,
  };
  const loop = monitorEventLoopDelay({ resolution: LOOP_RESOLUTION_MS });
  loop.enable();
  setInterval(() => {
    state.loopDelayP99Ms = Math.round((loop.percentile(P99) / NS_PER_MS) * 10) / 10;
    state.loopDelayMaxMs = Math.round((loop.max / NS_PER_MS) * 10) / 10;
    loop.reset();
  }, LOOP_WINDOW_MS).unref();

  process.on("unhandledRejection", (reason) => {
    state.unhandledRejections += 1;
    state.lastRejectionAt = new Date().toISOString();
    log.error(
      {
        err: messageOf(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
        count: state.unhandledRejections,
      },
      "unhandled rejection (kept running)",
    );
  });

  process.on("uncaughtException", (error, origin) => {
    // pino writes stdout synchronously by default, so the line lands before the exit.
    log.fatal({ err: error.message, stack: error.stack, origin }, "uncaught exception; exiting");
    process.exit(EXIT_FAILURE);
  });

  return { faults: () => ({ ...state }) };
}
