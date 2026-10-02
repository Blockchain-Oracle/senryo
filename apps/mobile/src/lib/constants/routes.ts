/**
 * Every app path (plan §2.4). The five dock destinations are Home · Markets · Card · Social · You (D-176, S1b.7);
 * Trade became market detail → ticket and Fund became the add-money hub. Old paths (`/portfolio`, `/trade/XAU`,
 * `/fund`, `/account`) still open the right place: deep links and push taps are remapped in `lib/deep-link.ts`
 * (`LEGACY_PATHS`), and the old in-app routes redirect. Deep links on the rpId host map 1:1 onto these.
 */
import type { Href } from "expo-router";

export const ROUTES = {
  welcome: "/welcome",
  home: "/home",
  markets: "/markets",
  /** Search, pushed on the Markets stack (F31): markets and traders. */
  marketSearch: "/markets/search",
  card: "/card",
  cardWallet: "/card/wallet",
  cardAllowance: "/card/allowance",
  /** C21 first-use tutorial, pushed over the Card tab. */
  cardIntro: "/card/intro",
  social: "/social",
  you: "/you",
  /** Compatibility: `/fund` opens the add-money hub over Home. */
  fund: "/fund",
  /** Home with the add-money hub opened over it (old `/fund` links). */
  homeAddMoney: "/home?open=add-money",
  fundWallet: "/fund/wallet",
  fundSwap: "/fund/swap",
  orders: "/orders",
  activity: "/activity",
  alerts: "/alerts",
  withdraw: "/withdraw",
  withdrawSend: "/withdraw/send",
  withdrawCashOut: "/withdraw/cash-out",
  lp: "/lp",
  /** Compatibility: `/account` is the You tab. */
  account: "/account",
  /** J9: the profile editor, the address page, and diagnostics (moved off the You tab). */
  accountSettings: "/account/settings",
  accountProfile: "/account/profile",
  accountIdentity: "/account/identity",
  accountDiagnostics: "/account/diagnostics",
  accountSecurity: "/account/security",
  accountRecovery: "/account/recovery",
  accountPreferences: "/account/preferences",
  accountSounds: "/account/sounds",
  accountNotifications: "/account/notifications",
  accountHelp: "/account/help",
  accountDeleteData: "/account/delete-data",
  accountMode: "/account/mode",
  accountTerms: "/account/terms",
  accountPrivacy: "/account/privacy",
  status: "/status",
  addMoney: "/add-money",
  /** Home's availability row: what each number means, what is locked, and the collateral behind them (direction §7). */
  balanceDetails: "/balance-details",
  /** The fan's Receive: compact QR sheet over the page under the fan (P21, FT057). */
  receive: "/receive",
  /** S8.22 mode selector sheet (the mode capsule). */
  network: "/network",
  stepUp: "/step-up",
  riskExplainer: "/risk-explainer",
  eligibility: "/eligibility",
  receipt: "/receipt",
  session: "/session",
  cardReveal: "/card-reveal",
  accountRequired: "/account-required",
  /** Redeem a voucher (the add-money hub's child sheet). */
  voucher: "/voucher",
  /** Social (J8, S1b.14): compose a thesis, and what a post or a profile's overflow opens. */
  composeThesis: "/compose-thesis",
  socialActions: "/social-actions",
  leaderboardInfo: "/leaderboard-info",
  /** Where a profile's listing and handle are edited. The You tab holds it until it has its own page (J9). */
  profileSettings: "/you",
  /** E1: limit → issue → ready, pushed on the Card stack. */
  cardGet: "/card/get",
  /** E1: the first-use explainer, continuing into Get card when it is finished. */
  cardIntroThenGet: "/card/intro?then=get",
  /** E3: the limit page in unfreeze mode (a new signed limit, then the issuer opens the card). */
  cardUnfreeze: "/card/allowance?unfreeze=1",
  /** E4: repay card debt from the trading account. */
  cardRepay: "/card/repay",
  /** G1: the inbox (bell), with All · Alerts. */
  notifications: "/notifications",
  /** G1 / C9: the inbox opened on its Alerts tab. */
  notificationAlerts: "/notifications?tab=alerts",
  /** E6: Activity filtered to the card's own rows (the Card tab's "See all"). */
  activityCard: "/activity?filter=card",
  /** A11: the terms sheet — setup's last step over Home, and the gate before the first money action. */
  termsSheet: "/terms",
  /** A10 / F5: who you muted and blocked, with Unmute / Unblock. */
  accountBlocked: "/account/blocked",
} as const;

/** A new account's first-run setup step (J1): `/setup/handle` … `/setup/done`. */
export const setupRoute = (step: string) => `/setup/${step}` as const;

export type TicketSide = "long" | "short";

/** Market detail, pushed on the Markets stack (the old `/trade/[market]`). */
export const marketRoute = (market: string) => `/markets/${market}` as const;
/** Review S03: a read-only instrument's page (Perpl crypto, calculated equity feeds) — no ticket. */
export const discoverRoute = (id: string) => `/markets/discover/${encodeURIComponent(id)}` as const;
/** J11: a spot token's page and its buy/sell ticket (Mainnet pools; `side` opens the ticket on that side). */
export const tokenRoute = (symbol: string) => `/markets/tokens/${symbol}` as const;
export const tokenTradeRoute = (symbol: string, side: "buy" | "sell") =>
  `/markets/tokens/${symbol}/trade?side=${side}` as const;
/** The order ticket over market detail (full-height transaction, C39), opened on a side from the sticky Short/Long. */
export const ticketRoute = (market: string, side: TicketSide) => `/markets/${market}/ticket?side=${side}` as const;
/** The price-alert editor for one market: a compact sheet over market detail (J3). */
export const alertRoute = (market: string) => `/markets/${market}/alert` as Href;
export const positionRoute = (id: string) => `/positions/${id}` as const;
export const cardAuthRoute = (id: string) => `/card/auth/${id}` as const;
export const fundQrRoute = (family: string) => `/fund/qr/${family}` as const;
export const depositRoute = (id: string) => `/fund/deposit/${id}` as const;
export const watchRoute = (address: string) => `/watch/${address}` as const;
/** A thesis with its replies, pushed on the Social stack. */
export const postRoute = (id: string) => `/social/post/${id}` as const;
/** The same thread opened from its author's profile (a root page), so back returns to the profile. */
export const traderPostRoute = (address: string, id: string) => `/watch/${address}/post/${id}` as const;
/** A trader's followers or following, pushed over their profile. */
export const followListRoute = (address: string, list: "followers" | "following") =>
  `/watch/${address}/${list}` as const;
/** A post's overflow: report, mute, block — or delete when it is yours. `thesis` marks the thread's own post. */
export const postActionsRoute = (post: { id: string; author: string; thesis: boolean }) =>
  `/social-actions?post=${post.id}&author=${post.author}&thesis=${post.thesis ? "1" : "0"}` as const;
/** A profile's overflow: report, mute, block. */
export const profileActionsRoute = (address: string) => `/social-actions?author=${address}` as const;
/** What the leaderboard ranks, for the period on screen. */
export const leaderboardInfoRoute = (period: string) => `/leaderboard-info?period=${period}` as const;

export type FollowDirection = "followers" | "following";
/** The signed-in account's followers or following list (J9). */
export const followsRoute = (direction: FollowDirection) => `/account/follows?direction=${direction}` as const;
/** The profile editor opened on one field ("Add a bio", "Add a username"). */
export type ProfileFocus = "username" | "name" | "bio";
export const profileEditRoute = (focus: ProfileFocus) => `/account/profile?focus=${focus}` as const;

/** The market the old Trade tab opened on (gold first, D-005); `/trade` links land on its detail. */
export const DEFAULT_MARKET = "XAU";

/**
 * A1: the account sheet for a guest's action — "Create an account to {verb}" — carrying the in-app path that resumes
 * it (the ticket on the same market and side, say) once the account exists and its setup is done or skipped.
 */
export type AccountVerb =
  | "trade"
  | "add money"
  | "follow"
  | "like"
  | "reply"
  | "post"
  | "set alerts"
  | "get a card"
  | "send";
export const accountRequiredRoute = (verb: AccountVerb, next?: string) =>
  `/account-required?verb=${encodeURIComponent(verb)}${next ? `&next=${encodeURIComponent(next)}` : ""}` as const;
/** Social (F1–F7, ui-social): People (leaderboard first), and Search inside the Social stack. */
export const socialPeopleRoute = "/social/people" as const;
export const socialSearchRoute = (kind?: "traders") =>
  (kind ? `/social/search?kind=${kind}` : "/social/search") as Href;
/** F5: Settings → Blocked & muted (two underline tabs, Muted · Blocked). */
export const blockedMutedRoute = "/account/blocked" as const;
/** F4: a trade post's overflow (report, mute, block); it is never deletable (the trade is onchain). */
export const tradePostActionsRoute = (post: { id: string; author: string }) =>
  `/social-actions?post=${post.id}&author=${post.author}&thesis=1&trade=1` as const;
/** F5: un-mute or un-block straight from the Blocked & muted list (the sheet opens on its confirmation). */
export const relationActionRoute = (address: string, act: "unmute" | "unblock") =>
  `/social-actions?author=${address}&act=${act}` as const;
/**
 * C11 "Trade this" (F-D3): the ticket over that market on the trader's side; the amount is never prefilled.
 * `leverage` is passed when the source knows it (the feed payload doesn't yet), for the ticket to read.
 */
export const tradeThisRoute = (market: string, side: TicketSide, leverage?: number) =>
  `${ticketRoute(market, side)}${leverage === undefined ? "" : `&leverage=${leverage}`}` as Href;
/** F6: Send with the recipient filled in (an @handle or an address); the send flow re-resolves it before signing. */
export const sendToRoute = (to: string) => `/withdraw/send?to=${encodeURIComponent(to)}` as Href;
