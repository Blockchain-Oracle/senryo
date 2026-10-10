/**
 * The web's places and Everything from the one nav source (`@senryo/config` `nav.ts`, D-268): lucide glyphs for the
 * nav icons, which place a path belongs to, and Everything's search.
 */
import { DOCK_NAV, WEB_EVERYTHING, WEB_RAIL, type WebIcon, type WebNavItem } from "@senryo/config";
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

/** The phone dock's order (`DOCK_NAV`) on the web's places; `more` opens Everything, the seal is Trade. */
export const DOCK = DOCK_NAV.map((d) => ({
  key: d.key,
  seal: d.icon === "seal",
  place: RAIL.find((r) => r.key === d.key),
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

/** Top-level places have no Back; anything deeper goes back to its place. */
export function placeOf(pathname: string | null): WebNavItem | undefined {
  return RAIL.find((item) => isActive(pathname, item));
}

export function searchNav(items: readonly WebNavItem[], query: string): WebNavItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  return items.filter((i) => `${i.label} ${i.description} ${i.keywords ?? ""}`.toLowerCase().includes(q));
}
