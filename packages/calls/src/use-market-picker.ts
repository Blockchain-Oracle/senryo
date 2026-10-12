/**
 * The market picker's sections (P2, D-321), both apps: `pickerSections` with Hot ranked from the shared 24 h read —
 * each market's last close against the price 24 hours ago (`/v1/prices/day`, one cached read refreshed each minute).
 * Favourites and recents come from each app's own storage.
 */
import { useDayPrices } from "@senryo/query";
import { useMemo } from "react";
import { hotSymbols, type PickerFilter, pickerSections } from "./market-picker.ts";

interface PickerMarket {
  symbol: string;
  name: string;
  kind: string;
}

function lastClose(spark: readonly (number | null)[]): number | null {
  for (let i = spark.length - 1; i >= 0; i--) {
    const v = spark[i];
    if (v !== null && v !== undefined) return v;
  }
  return null;
}

export function useMarketPicker<T extends PickerMarket>(
  markets: readonly T[],
  o: { query: string; filter: PickerFilter; favourites: readonly string[]; recents: readonly string[] },
): { label: string; markets: T[] }[] {
  const day = useDayPrices();
  const daily = "value" in day ? day.value.markets : undefined;
  const hot = useMemo(
    () =>
      hotSymbols(markets, (symbol) => {
        const m = daily?.[symbol];
        const last = m ? lastClose(m.spark) : null;
        return m && last !== null && m.openE8 > 0 ? (last - m.openE8) / m.openE8 : null;
      }),
    [markets, daily],
  );
  const { query, filter, favourites, recents } = o;
  return useMemo(
    () => pickerSections(markets, { query, filter, favourites, recents, hot }),
    [markets, query, filter, favourites, recents, hot],
  );
}
