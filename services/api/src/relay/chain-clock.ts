import { SimulationRevertedError } from "@senryo/chain";
import { MS_PER_SECOND } from "@senryo/service-common";
import { CHAIN_CLOCK_SLACK_MS, FUTURE_PRINT_RETRIES, FUTURE_PRINT_RETRY_MS } from "./constants.ts";

/**
 * Monad stamps blocks in whole seconds and the relay hears a print ~0.2 s after it publishes — before any block can
 * carry that second. The verifier rightly refuses a print from the future (`OutOfWindow(t, t)`), so a print published
 * in second t is used once a block stamped ≥ t can exist, and a refusal for that reason alone is retried briefly.
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Resolves once the chain can have produced a block stamped `t` (the second after it starts, less one block). */
export async function untilChainReaches(t: number): Promise<void> {
  const wait = (t + 1) * MS_PER_SECOND - CHAIN_CLOCK_SLACK_MS - Date.now();
  if (wait > 0) await sleep(wait);
}

/** Refusals that only mean "the chain's clock hasn't reached the print yet". */
const NOT_YET = new Set(["OutOfWindow", "NoOpenPrint"]);

export async function retryWhileEarly<T>(send: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await send();
    } catch (error) {
      const early = error instanceof SimulationRevertedError && NOT_YET.has(error.revert?.name.split("(")[0] ?? "");
      if (!early || attempt >= FUTURE_PRINT_RETRIES) throw error;
      await sleep(FUTURE_PRINT_RETRY_MS);
    }
  }
}
