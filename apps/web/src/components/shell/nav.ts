/**
 * The web's places and Everything from the one nav source (`@senryo/config` `nav.ts`, D-268): lucide glyphs for the
 * nav icons, which place a path belongs to, and Everything's search.
 */
import { DOCK_NAV, WEB_EVERYTHING, WEB_PLACES, WEB_RAIL, type WebIcon, type WebNavItem } from "@senryo/config";
import {
  ArrowDownToLine,
  ArrowUpRight,
  ChartCandlestick,
  CircleHelp,
  Coins,
  Gamepad2,
  House,
  Landmark,
  Layers,
  type LucideIcon,
  Receipt,
  ScrollText,
  Settings,
  Smartphone,
  Swords,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";

export const NAV_ICON: Record<WebIcon, LucideIcon> = {
  home: House,
  trade: TrendingUp,
  markets: ChartCandlestick,
  calls: Receipt,
  dollars: Coins,
  receive: ArrowDownToLine,
  withdraw: ArrowUpRight,
  settings: Settings,
  oneTap: Zap,
  help: CircleHelp,
  proof: ScrollText,
  download: Smartphone,
  earn: Landmark,
  parlay: Layers,
  duel: Swords,
  events: Trophy,
  games: Gamepad2,
};

export const RAIL: readonly WebNavItem[] = WEB_RAIL;
export const EVERYTHING = WEB_EVERYTHING;
/** Rail keys 1…n jump to the places; the next key opens Everything. */
export const EVERYTHING_KEY = String(RAIL.length + 1);

/** The phone dock's order (`DOCK_NAV`) on the web's places (Home included); `more` opens Everything, the seal is Trade. */
export const DOCK = DOCK_NAV.map((d) => ({
  key: d.key,
  seal: d.icon === "seal",
  place: WEB_PLACES.find((r) => r.key === d.key),
}));

/** `/app/trade/btc/` → `/app/trade/`: the place a path belongs to (Home is its own path only). */
function section(href: string): string {
  const parts = href.split("?")[0]?.split("/").filter(Boolean) ?? [];
  return `/${parts.slice(0, 2).join("/")}/`;
}

export function isActive(pathname: string | null, item: WebNavItem): boolean {
  if (!pathname) return false;
  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  const home = section(item.href) === "/app/";
  return home ? path === "/app/" : path.startsWith(section(item.href));
}

/** The place a path is under (Home or a rail place), if any. */
export function placeOf(pathname: string | null): WebNavItem | undefined {
  return WEB_PLACES.find((item) => isActive(pathname, item));
}

/**
 * Pages outside the rail and where their Back goes (R2.14): the play pages to Games (its hub lists them), an event to
 * Events, setup to Home. Keyed by the path's first two segments.
 */
const PARENTS: Readonly<Record<string, { label: string; href: string }>> = {
  "/app/parlay/": { label: "Games", href: "/app/games/" },
  "/app/duel/": { label: "Games", href: "/app/games/" },
  "/app/events/": { label: "Games", href: "/app/games/" },
  "/app/event/": { label: "Events", href: "/app/events/" },
  "/app/setup/": { label: "Home", href: "/app/" },
};

/**
 * Where Back goes from a path, or undefined at a place's own page (and on Trade, whose market is the page): deeper in
 * a place, to that place; elsewhere, to its parent.
 */
export function backOf(pathname: string | null): { label: string; href: string } | undefined {
  if (!pathname) return undefined;
  const place = placeOf(pathname);
  if (place) {
    const own = section(place.href) === "/app/" ? "/app/" : section(place.href);
    const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
    if (place.key === "trade" || path === own || path === place.href) return undefined;
    return { label: place.label, href: place.href };
  }
  return PARENTS[section(pathname)];
}

export function searchNav(items: readonly WebNavItem[], query: string): WebNavItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  return items.filter((i) => `${i.label} ${i.description} ${i.keywords ?? ""}`.toLowerCase().includes(q));
}
