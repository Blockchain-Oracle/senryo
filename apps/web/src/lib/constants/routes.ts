/** The market a bare Trade link opens on (gold, the first engine market). */
export const DEFAULT_MARKET = "XAU";

/**
 * Same paths as the phone where the static export allows (flow book G2): per-address and per-id pages take a query
 * parameter, because the export cannot pre-render every address. Legacy desk paths (`/portfolio/`, `/fund/`) remap.
 */
export const ROUTES = {
  welcome: "/",
  home: "/home/",
  portfolio: "/portfolio/",
  addMoney: "/add-money/",
  receive: "/receive/",
  send: "/send/",
  withdraw: "/withdraw/",
  markets: "/markets/",
  trade: (market: string) => `/trade/${market.replace("/", "")}/`,
  card: "/card/",
  fund: "/fund/",
  social: "/social/",
  profile: "/profile/",
  account: "/account/",
  setup: "/setup/",
  watch: "/watch/",
  pool: "/pool/",
  activity: "/activity/",
  notifications: "/notifications/",
  swap: "/swap/",
  bridgeIn: "/bridge-in/",
  /** Public pages outside the app shell (D-022 traction, F90 judge path). */
  stats: "/stats/",
  judges: "/judges/",
} as const;

/** The stats page on one network (the switch's deep link; `chainId` as in watch links). */
export const statsHref = (chainId: number) => `/stats/?chainId=${chainId}` as const;

/** A position's page (one net position per engine market). */
export const positionHref = (market: string) => `/position/?market=${market}` as const;
/** An asset's page on this network (any token; `0x000…000` is MON). */
export const assetHref = (address: string) => `/asset/?address=${address.toLowerCase()}` as const;
/** Send prefilled with a recipient (a profile's Send). */
export const sendToHref = (address: string) => `/send/?to=${address}` as const;
/**
 * The shared watch / profile link (flow book G2 decision): the static form with the network, so the profile opens in
 * the right mode on any device. Without `chainId` the current network is used.
 */
export const watchHref = (address: string, chainId?: number) =>
  chainId === undefined ? `/watch/?address=${address}` : `/watch/?address=${address}&chainId=${chainId}`;

export type AppTab = { id: string; label: string; href: string; match: readonly string[] };

/** The five destinations, as on the phone's dock: Home · Markets · Card · Social · You. */
export const APP_TABS: readonly AppTab[] = [
  {
    id: "home",
    label: "Home",
    href: ROUTES.home,
    match: [
      "/home",
      "/portfolio",
      "/add-money",
      "/receive",
      "/asset",
      "/pool",
      "/activity",
      "/notifications",
      "/swap",
      "/send",
      "/withdraw",
    ],
  },
  { id: "markets", label: "Markets", href: ROUTES.markets, match: ["/markets", "/trade", "/position"] },
  { id: "card", label: "Card", href: ROUTES.card, match: ["/card"] },
  { id: "social", label: "Social", href: ROUTES.social, match: ["/social", "/watch"] },
  { id: "you", label: "You", href: ROUTES.profile, match: ["/profile", "/account", "/setup"] },
];

export function activeTab(pathname: string): string | undefined {
  return APP_TABS.find((t) => t.match.some((m) => pathname.startsWith(m)))?.id;
}

/** Setup's terms step, then back to `next` (flow book A11: terms before the first money action). */
export const setupHref = (next: string) => `/setup/?next=${encodeURIComponent(next)}`;
