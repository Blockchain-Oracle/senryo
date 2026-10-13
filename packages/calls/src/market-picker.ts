/**
 * The market picker's sections (P2, D-321; Tradash's markets sheet, research `review-2026-10-12`), both apps: your
 * favourites, the hot movers (the six biggest 24 h moves), your recent markets on an empty search, then the kind
 * groups. Every open starts at All with an empty search; a market never shows twice. A search ranks as ⌘K does (R6.2).
 */
import { groupMarkets, MARKET_FILTERS, type MarketFilter, marketScores } from "./markets.ts";

export type PickerFilter = "favourites" | "hot" | MarketFilter;

export const PICKER_FILTERS: readonly { value: PickerFilter; label: string }[] = [
  { value: "favourites", label: "Favourites" },
  { value: "hot", label: "Hot" },
  ...MARKET_FILTERS,
];

export const HOT_COUNT = 6;
export const RECENT_COUNT = 5;

interface PickerMarket {
  symbol: string;
  name: string;
  kind: string;
}

/** The six markets that moved most over 24 h, by the size of the move (`moveOf` is the signed fraction, or null). */
export function hotSymbols(
  markets: readonly PickerMarket[],
  moveOf: (symbol: string) => number | null,
  count = HOT_COUNT,
): string[] {
  return markets
    .map((m) => ({ symbol: m.symbol, move: moveOf(m.symbol) }))
    .filter((m): m is { symbol: string; move: number } => m.move !== null)
    .sort((a, b) => Math.abs(b.move) - Math.abs(a.move))
    .slice(0, count)
    .map((m) => m.symbol);
}

export function pickerSections<T extends PickerMarket>(
  markets: readonly T[],
  o: {
    query: string;
    filter: PickerFilter;
    favourites: readonly string[];
    recents: readonly string[];
    hot: readonly string[];
  },
): { label: string; markets: T[] }[] {
  const q = o.query.trim();
  const scored = q ? marketScores(markets, q) : null;
  const hit = (m: T) => scored === null || scored.has(m.symbol);
  const bySymbol = (symbols: readonly string[]) =>
    symbols.map((s) => markets.find((m) => m.symbol === s)).filter((m): m is T => m !== undefined && hit(m));
  if (o.filter === "favourites") {
    const favs = bySymbol(o.favourites);
    return favs.length > 0 ? [{ label: "Favourites", markets: favs }] : [];
  }
  if (o.filter === "hot") {
    const hot = bySymbol(o.hot);
    return hot.length > 0 ? [{ label: "Biggest moves · 24 h", markets: hot }] : [];
  }
  if (o.filter !== "all" || q) return groupMarkets(markets, o.query, o.filter);
  const recent = bySymbol(o.recents.slice(0, RECENT_COUNT));
  const shown = new Set(recent.map((m) => m.symbol));
  const groups = groupMarkets(
    markets.filter((m) => !shown.has(m.symbol)),
    "",
    "all",
  );
  return recent.length > 0 ? [{ label: "Recent", markets: recent }, ...groups] : groups;
}

export function toggleFavourite(list: readonly string[], symbol: string): string[] {
  return list.includes(symbol) ? list.filter((s) => s !== symbol) : [...list, symbol];
}

/** A stored list of symbols (JSON), or empty when absent or unreadable. */
export function readSymbols(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}
