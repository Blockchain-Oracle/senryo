/**
 * Every app path (plan §2.4). The five dock destinations are Home · Markets · Card · Social · You (D-176, S1b.7);
 * Trade became market detail → ticket and Fund became the add-money hub. Old paths (`/portfolio`, `/trade/XAU`,
 * `/fund`, `/account`) still open the right place: deep links and push taps are remapped in `lib/deep-link.ts`
 * (`LEGACY_PATHS`), and the old in-app routes redirect. Deep links on the rpId host map 1:1 onto these.
 */
export const ROUTES = {
  welcome: "/welcome",
  home: "/home",
  markets: "/markets",
  card: "/card",
  cardWallet: "/card/wallet",
  cardAllowance: "/card/allowance",
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
  accountProfile: "/account/profile",
  accountIdentity: "/account/identity",
  accountDiagnostics: "/account/diagnostics",
  accountSecurity: "/account/security",
  accountRecovery: "/account/recovery",
  accountPreferences: "/account/preferences",
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
  receipt: "/receipt",
  session: "/session",
  cardReveal: "/card-reveal",
  accountRequired: "/account-required",
} as const;

/** A new account's first-run setup step (J1): `/setup/handle` … `/setup/done`. */
export const setupRoute = (step: string) => `/setup/${step}` as const;

export type TicketSide = "long" | "short";

/** Market detail, pushed on the Markets stack (the old `/trade/[market]`). */
export const marketRoute = (market: string) => `/markets/${market}` as const;
/** The order ticket over market detail (full-height transaction, C39), opened on a side from the sticky Short/Long. */
export const ticketRoute = (market: string, side: TicketSide) => `/markets/${market}/ticket?side=${side}` as const;
export const positionRoute = (id: string) => `/positions/${id}` as const;
export const cardAuthRoute = (id: string) => `/card/auth/${id}` as const;
export const fundQrRoute = (family: string) => `/fund/qr/${family}` as const;
export const depositRoute = (id: string) => `/fund/deposit/${id}` as const;
export const watchRoute = (address: string) => `/watch/${address}` as const;

export type FollowDirection = "followers" | "following";
/** The signed-in account's followers or following list (J9). */
export const followsRoute = (direction: FollowDirection) => `/account/follows?direction=${direction}` as const;
/** The profile editor opened on one field ("Add a bio", "Add a username"). */
export type ProfileFocus = "username" | "name" | "bio";
export const profileEditRoute = (focus: ProfileFocus) => `/account/profile?focus=${focus}` as const;

/** The market the old Trade tab opened on (gold first, D-005); `/trade` links land on its detail. */
export const DEFAULT_MARKET = "XAU";
