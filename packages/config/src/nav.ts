/**
 * The one navigation source (D-268): what the phone dock, the phone's More grid and the web rail list, as pure data.
 * Apps map `icon` to their own glyphs; every `path` must resolve to a route (invariant `nav-route-coverage`).
 * Phone dock: Home · Markets · [seal = Trade] · Calls · More.
 */
export type NavIcon =
  | "home"
  | "markets"
  | "seal"
  | "calls"
  | "more"
  | "profile"
  | "wallet"
  | "notifications"
  | "settings"
  | "receive"
  | "status"
  | "earn"
  | "parlay";

export interface NavItem {
  key: string;
  label: string;
  icon: NavIcon;
  /** The app path (expo-router strips route groups). */
  path: string;
}

export const DOCK_NAV = [
  { key: "home", label: "Home", icon: "home", path: "/home" },
  { key: "markets", label: "Markets", icon: "markets", path: "/markets" },
  { key: "trade", label: "Trade", icon: "seal", path: "/trade" },
  { key: "calls", label: "Calls", icon: "calls", path: "/calls" },
  { key: "more", label: "More", icon: "more", path: "/more" },
] as const satisfies readonly NavItem[];

export type DockKey = (typeof DOCK_NAV)[number]["key"];

/** The More grid (phone) and the rail's secondary group (web), in order. */
export const MORE_NAV = [
  { key: "parlay", label: "Parlay", icon: "parlay", path: "/parlay" },
  { key: "wallet", label: "Wallet", icon: "wallet", path: "/wallet" },
  { key: "earn", label: "Earn", icon: "earn", path: "/earn" },
  { key: "profile", label: "Profile", icon: "profile", path: "/account/profile" },
  { key: "receive", label: "Receive", icon: "receive", path: "/receive" },
  { key: "notifications", label: "Notifications", icon: "notifications", path: "/notifications" },
  { key: "settings", label: "Settings", icon: "settings", path: "/account/settings" },
  { key: "status", label: "Status", icon: "status", path: "/status" },
] as const satisfies readonly NavItem[];

/**
 * The web app (S6; Mitoshi S22's rail): its places with their keys (1, 2, 3 …; the next key opens Everything), then
 * Everything's groups (D-190: a right drawer, `?d=everything`). The places are the phone dock's, by key: under 768 px
 * the web's dock is `DOCK_NAV` in its order (the seal opens Trade, More opens Everything). Places arrive with their
 * stage — Earn at S7, Games and the Leaderboard at S8 — never as a placeholder. `href` is the web path (invariant
 * `nav-route-coverage` checks it against `apps/web/src/app`; a `?d=` drawer link checks its page).
 */
export type WebIcon =
  | "home"
  | "trade"
  | "markets"
  | "calls"
  | "dollars"
  | "receive"
  | "withdraw"
  | "settings"
  | "oneTap"
  | "help"
  | "proof"
  | "download"
  | "earn"
  | "parlay";

export interface WebNavItem {
  key: string;
  label: string;
  icon: WebIcon;
  href: string;
  /** One line under the name in Everything and ⌘K. */
  description: string;
  /** Extra words Everything's search matches. */
  keywords?: string;
}

export const WEB_RAIL = [
  {
    key: "home",
    label: "Home",
    icon: "home",
    href: "/app/",
    description: "Your balance, open calls and the markets.",
    keywords: "overview balance",
  },
  {
    key: "trade",
    label: "Trade",
    icon: "trade",
    href: "/app/trade/btc/",
    description: "The live line: call Up or Down in one tap.",
    keywords: "terminal chart up down",
  },
  {
    key: "markets",
    label: "Markets",
    icon: "markets",
    href: "/app/markets/",
    description: "Every market and its next window.",
    keywords: "btc eth sol crypto",
  },
  {
    key: "calls",
    label: "Calls",
    icon: "calls",
    href: "/app/calls/",
    description: "Open calls, results and their receipts.",
    keywords: "history receipts proof",
  },
] as const satisfies readonly WebNavItem[];

export interface WebNavSection {
  key: string;
  label: string;
  items: readonly WebNavItem[];
}

export const WEB_EVERYTHING = [
  {
    key: "play",
    label: "Play",
    items: [
      {
        key: "parlay",
        label: "Parlay",
        icon: "parlay",
        href: "/app/parlay/",
        description: "Two to four calls that must all come true; the odds multiply.",
        keywords: "combo accumulator multi legs",
      },
    ],
  },
  {
    key: "money",
    label: "Money",
    items: [
      {
        key: "dollars",
        label: "Test dollars",
        icon: "dollars",
        href: "/app/?d=wallet",
        description: "Practice balance and a daily top-up.",
        keywords: "wallet balance faucet",
      },
      {
        key: "receive",
        label: "Receive",
        icon: "receive",
        href: "/app/?d=receive",
        description: "Your Monad address and its QR.",
      },
      {
        key: "withdraw",
        label: "Withdraw",
        icon: "withdraw",
        href: "/app/?d=withdraw",
        description: "Send dollars to a Monad address.",
        keywords: "send transfer",
      },
      {
        key: "earn",
        label: "Earn",
        icon: "earn",
        href: "/app/earn/",
        description: "Supply the pool that takes the other side; withdraw at the hour.",
        keywords: "pool supply yield house liquidity",
      },
    ],
  },
  {
    key: "records",
    label: "Records & proof",
    items: [
      {
        key: "calls-history",
        label: "Every call",
        icon: "calls",
        href: "/app/calls/",
        description: "Each call with its transactions and the window's prints.",
        keywords: "receipt history",
      },
      {
        key: "proof",
        label: "Proof",
        icon: "proof",
        href: "/proof/",
        description: "Every window's two prices, posted on chain — re-check any of them yourself.",
        keywords: "verify pyth print oracle",
      },
    ],
  },
  {
    key: "account",
    label: "Account",
    items: [
      {
        key: "settings",
        label: "Settings",
        icon: "settings",
        href: "/app/?d=settings",
        description: "Sound & vibration, theme, your passkey.",
        keywords: "sound haptics theme",
      },
      {
        key: "one-tap",
        label: "One-tap calls",
        icon: "oneTap",
        href: "/app/?d=one-tap",
        description: "Turn it on or off; caps are enforced on chain.",
        keywords: "session",
      },
    ],
  },
  {
    key: "learn",
    label: "Learn",
    items: [
      {
        key: "how",
        label: "How it works",
        icon: "help",
        href: "/",
        description: "Calls, the pool, Practice and Real.",
      },
      {
        key: "judges",
        label: "For judges",
        icon: "download",
        href: "/judges/",
        description: "Install paths, contracts and proof.",
        keywords: "download testflight",
      },
    ],
  },
] as const satisfies readonly WebNavSection[];
