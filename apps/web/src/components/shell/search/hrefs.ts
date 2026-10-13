/**
 * Where a search entry lives on the web (R6): the places search ranks (Home, the rail, Everything — not the rows that
 * are money actions), each place's and game's path, and a page target's link. ⌘K and the 404's "Did you mean" share it.
 */
import { GAMES, WEB_EVERYTHING, WEB_PLACES, type WebNavItem } from "@senryo/config";
import { intentQuery, type SearchTarget } from "@senryo/search";
import { tradeHref } from "@/features/markets/MarketList";

/** Everything's rows that are actions here (money moves through drawers; one-tap has its own action). */
const NOT_PLACES = new Set(["dollars", "receive", "withdraw", "one-tap"]);
const NAV: readonly WebNavItem[] = [...WEB_PLACES, ...WEB_EVERYTHING.flatMap((s): readonly WebNavItem[] => s.items)];
export const SEARCH_PLACES = NAV.filter((p) => !NOT_PLACES.has(p.key));
export const HREF: Record<string, string> = {
  ...Object.fromEntries(NAV.map((p) => [p.key, p.href])),
  ...Object.fromEntries(GAMES.map((g) => [g.key, g.href])),
};
/** A place that is a drawer over Home (`/app/?d=wallet`). */
export const DRAWER_PREFIX = "/app/?d=";

/** A page target's link (a market's terminal with its intent, a place, a game); null for anything else. */
export function pageHref(t: SearchTarget): string | null {
  switch (t.kind) {
    case "terminal":
      return `${tradeHref(t.intent.symbol)}${intentQuery(t.intent)}`;
    case "market":
      return tradeHref(t.symbol);
    case "place":
      return HREF[t.key] ?? null;
    default:
      return null;
  }
}
