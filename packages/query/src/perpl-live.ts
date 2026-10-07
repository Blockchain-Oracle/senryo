import { useCallback, useSyncExternalStore } from "react";
import { useQueryEnv } from "./env.tsx";

/** Raw venue ticks for display. An order still re-reads executable terms under its review guard. */
export function usePerplLivePrice(marketId: number) {
  const { perplPrices } = useQueryEnv();
  const get = useCallback(() => perplPrices.get(marketId), [perplPrices, marketId]);
  return useSyncExternalStore(perplPrices.subscribe, get, get);
}
