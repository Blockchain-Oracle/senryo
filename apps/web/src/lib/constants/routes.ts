/**
 * Web paths after the prediction-market pivot (D-256). The public site is the landing, the judge guide and the legal
 * pages; the app arrives at `/app/` in S6 (the crypto-world-fair shell with the Owarine terminal, D-269). The static
 * export uses trailing slashes.
 */
export const ROUTES = {
  welcome: "/",
  /** The web app (S6): sign-in lands here; `/app/trade/<SYMBOL>/` is the terminal. */
  app: "/app/",
  /** First-run setup inside the app (S6). */
  setup: "/app/setup/",
  /** Account and session settings inside the app (S6). */
  account: "/app/account/",
  judges: "/judges/",
  terms: "/terms/",
  privacy: "/privacy/",
} as const;
