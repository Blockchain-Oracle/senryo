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
}

export interface ProcessGuards {
  faults(): ProcessFaults;
}

const EXIT_FAILURE = 1;

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

/** Install once, as early as possible in a service's `main.ts`. */
export function installProcessGuards(log: Logger): ProcessGuards {
  const state: ProcessFaults = { unhandledRejections: 0, lastRejectionAt: null };

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
