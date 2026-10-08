import { useCallback, useSyncExternalStore } from "react";
import { useQueryEnv } from "./env.tsx";

/** Raw venue ticks for display. An order still re-reads executable terms under its review guard. */
export function usePerplLivePrice(marketId: number) {
  const { perplPrices } = useQueryEnv();
  const get = useCallback(() => perplPrices.get(marketId), [perplPrices, marketId]);
  return useSyncExternalStore(perplPrices.subscribe, get, get);
}

/** Transport state is distinct from source freshness; connected does not prove an account snapshot. */
export function usePerplConnection() {
  const { perplPrices } = useQueryEnv();
  const state = useSyncExternalStore(perplPrices.subscribe, perplPrices.getConnection, perplPrices.getConnection);
  return { state, epoch: perplPrices.getEpoch() };
}
