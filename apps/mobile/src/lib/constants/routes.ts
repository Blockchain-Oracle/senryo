/**
 * Every app path (same paths on web, plan §2.4). Deep links on the rpId host map 1:1 onto these (S12 allowlists them).
 * Moves to `packages/config` ROUTES when it lands.
 */
export const ROUTES = {
  welcome: "/welcome",
  portfolio: "/portfolio",
  markets: "/markets",
  trade: "/trade",
  card: "/card",
  cardWallet: "/card/wallet",
  cardAllowance: "/card/allowance",
  fund: "/fund",
  fundWallet: "/fund/wallet",
  fundSwap: "/fund/swap",
  orders: "/orders",
  activity: "/activity",
  alerts: "/alerts",
  withdraw: "/withdraw",
  withdrawSend: "/withdraw/send",
  withdrawCashOut: "/withdraw/cash-out",
  lp: "/lp",
  account: "/account",
  accountSecurity: "/account/security",
  accountRecovery: "/account/recovery",
  accountPreferences: "/account/preferences",
  accountNotifications: "/account/notifications",
  accountHelp: "/account/help",
  accountDeleteData: "/account/delete-data",
  accountMode: "/account/mode",
  status: "/status",
  addMoney: "/add-money",
  stepUp: "/step-up",
  riskExplainer: "/risk-explainer",
  receipt: "/receipt",
  session: "/session",
  cardReveal: "/card-reveal",
  accountRequired: "/account-required",
} as const;

export const tradeRoute = (market: string) => `/trade/${market}` as const;
export const positionRoute = (id: string) => `/positions/${id}` as const;
export const cardAuthRoute = (id: string) => `/card/auth/${id}` as const;
export const fundQrRoute = (family: string) => `/fund/qr/${family}` as const;
export const depositRoute = (id: string) => `/fund/deposit/${id}` as const;
export const watchRoute = (address: string) => `/watch/${address}` as const;

/** The default market the Trade tab opens on (gold first, D-005). */
export const DEFAULT_MARKET = "XAU";
