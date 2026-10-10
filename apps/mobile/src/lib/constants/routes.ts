/**
 * Every app path after the prediction-market pivot (D-256). The dock holds Home · Markets · Trade · Calls · More and
 * More the rest, from the shared navigation source (`packages/config/src/nav.ts`, D-268). Links on the rpId host —
 * the web's `/app/*` and `/call` included — and retired paths are mapped onto these in `lib/deep-link.ts`.
 */
import type { Href } from "expo-router";

export const ROUTES = {
  welcome: "/welcome",
  home: "/home",
  markets: "/markets",
  more: "/more",
  /** Compatibility: `/account` is the You tab. */
  account: "/account",
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
  /** The privacy notice (legal). */
  accountPrivacy: "/account/privacy",
  status: "/status",
  /** The fan's Receive: compact QR sheet over the page under the fan (P21, FT057). */
  receive: "/receive",
  /** S8.22 mode selector sheet (the mode capsule). */
  network: "/network",
  stepUp: "/step-up",
  session: "/session",
  accountRequired: "/account-required",
  /** Where a profile's listing and handle are edited. */
  profileSettings: "/more",
  /** G1: the inbox (bell). */
  notifications: "/notifications",
  /** A11: the terms sheet — setup's last step over Home, and the gate before the first money action. */
  termsSheet: "/terms",
  /** S5.12: Withdraw, a sheet over the Wallet (an EIP-3009 transfer the relay submits). */
  withdraw: "/withdraw",
} as const;

/** A new account's first-run setup step (J1): its `/setup/<step>` page; terms and Face ID land on Home instead. */
export const setupRoute = (step: string) =>
  step === "face-id" || step === "terms" ? ROUTES.home : (`/setup/${step}` as const);

/** The profile editor opened on one field ("Add a bio", "Add a username"). */
export type ProfileFocus = "username" | "name" | "bio";
export const profileEditRoute = (focus: ProfileFocus) => `/account/profile?focus=${focus}` as const;

/**
 * A1: the account sheet for a guest's action — "Create an account to {verb}" — carrying the in-app path that resumes
 * it once the account exists and its setup is done or skipped.
 */
export type AccountVerb =
  | "make a call"
  | "add money"
  | "follow"
  | "set alerts"
  | "send"
  | "earn"
  | "place a parlay"
  | "duel"
  | "call an event";
export const accountRequiredRoute = (verb: AccountVerb, next?: string) =>
  `/account-required?verb=${encodeURIComponent(verb)}${next ? `&next=${encodeURIComponent(next)}` : ""}` as const;

/** B3: the receive sheet (the address never changes). */
export const receiveRoute = () => "/receive" as Href;
