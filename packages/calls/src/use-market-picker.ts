/**
 * The market picker's sections (P2, D-321), both apps: `pickerSections` with Hot ranked from the shared 24 h read —
 * each market's last close against the price 24 hours ago (`/v1/prices/day`, one cached read refreshed each minute).
 * Recents are the device's visits (D-337); favourites come from each app's own storage.
 */
import { useDayPrices } from "@senryo/query";
import { recentIds } from "@senryo/search";
import { useVisitsVersion } from "@senryo/search/react";
import { useMemo } from "react";
import { hotSymbols, type PickerFilter, pickerSections, RECENT_COUNT } from "./market-picker.ts";

interface PickerMarket {
  symbol: string;
  name: string;
  kind: string;
}

const MARKET_PREFIX = "market:";

function lastClose(spark: readonly (number | null)[]): number | null {
  for (let i = spark.length - 1; i >= 0; i--) {
    const v = spark[i];
    if (v !== null && v !== undefined) return v;
  }
  return null;
}

/** The biggest 24 h movers among `markets`, by the size of the move (search's Hot and the picker's). */
export function useHotSymbols(markets: readonly PickerMarket[]): string[] {
  const day = useDayPrices();
  const daily = "value" in day ? day.value.markets : undefined;
  return useMemo(
    () =>
      hotSymbols(markets, (symbol) => {
        const m = daily?.[symbol];
        const last = m ? lastClose(m.spark) : null;
        return m && last !== null && m.openE8 > 0 ? (last - m.openE8) / m.openE8 : null;
      }),
    [markets, daily],
  );
}

/** The markets this device opened last, newest first (its visits). */
export function useRecentMarkets(count = RECENT_COUNT): string[] {
  const version = useVisitsVersion();
  // The visits' version is the trigger.
  return useMemo(() => recentIds(count, MARKET_PREFIX).map((id) => id.slice(MARKET_PREFIX.length)), [count, version]);
}

export function useMarketPicker<T extends PickerMarket>(
  markets: readonly T[],
  o: { query: string; filter: PickerFilter; favourites: readonly string[] },
): { label: string; markets: T[] }[] {
  const hot = useHotSymbols(markets);
  const recents = useRecentMarkets();
  const { query, filter, favourites } = o;
  return useMemo(
    () => pickerSections(markets, { query, filter, favourites, recents, hot }),
    [markets, query, filter, favourites, recents, hot],
  );
}
