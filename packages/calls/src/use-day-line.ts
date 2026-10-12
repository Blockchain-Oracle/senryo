/**
 * A market's 24-hour line (D-319): its closes and the price 24 hours ago from `/v1/prices/day` (one cached read shared
 * by every row, refreshed each minute). Undefined until it arrives or when the archive has no candles for it.
 */
import { useDayPrices } from "@senryo/query";
import type { DayLine } from "./spark.ts";

export function useDayLine(symbol: string): DayLine | undefined {
  const day = useDayPrices();
  if (!("value" in day)) return undefined;
  const m = day.value.markets[symbol];
  return m ? { openE8: m.openE8, spark: m.spark } : undefined;
}
