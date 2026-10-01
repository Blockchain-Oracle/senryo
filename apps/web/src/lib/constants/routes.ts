/** The market the Trade tab opens on (gold, our first engine market). */
export const DEFAULT_MARKET = "XAU";

/** Same paths on web and mobile (plan §2.4 Screens). */
export const ROUTES = {
  welcome: "/",
  portfolio: "/portfolio/",
  markets: "/markets/",
  trade: (market: string) => `/trade/${market.replace("/", "")}/`,
  card: "/card/",
  fund: "/fund/",
  account: "/account/",
  watch: "/watch/",
} as const;

export type DeskTab = { id: string; label: string; href: string; match: string };

/** D2 top tabs (Vercel Tabs #1597). `match` is the pathname prefix that marks the tab active. */
export const DESK_TABS: readonly DeskTab[] = [
  { id: "portfolio", label: "Portfolio", href: ROUTES.portfolio, match: "/portfolio" },
  { id: "markets", label: "Markets", href: ROUTES.markets, match: "/markets" },
  { id: "trade", label: "Trade", href: ROUTES.trade(DEFAULT_MARKET), match: "/trade" },
  { id: "card", label: "Card", href: ROUTES.card, match: "/card" },
  { id: "fund", label: "Fund", href: ROUTES.fund, match: "/fund" },
];

export function activeTab(pathname: string): string | undefined {
  return DESK_TABS.find((t) => pathname.startsWith(t.match))?.id;
}

/** Read-only watch link (D-031). A query param, because the static export cannot pre-render every address. */
export const watchHref = (address: string) => `/watch/?address=${address}` as const;
