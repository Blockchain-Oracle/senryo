import { useFeedState, useLive, useStreamStatus } from "@senryo/live/react";
import { type PriceHealth, priceHealth } from "./price-health.ts";
import { useMarketLine } from "./use-market-session.ts";

/**
 * A market's price health for the chip, the chart's tag and the call panel (04-pricing R7): re-rendered when the state
 * or the stream changes, and once a second for the age (`useMarketLine` keeps the server second).
 */
export function usePriceHealth(symbol: string): PriceHealth {
  const live = useLive();
  const stream = useStreamStatus();
  const state = useFeedState(symbol);
  const line = useMarketLine(symbol);
  const t = live.prices.latest(symbol);
  return priceHealth({ stream, state, ageMs: t ? live.clock.now() - t.publishMs : null, line });
}
