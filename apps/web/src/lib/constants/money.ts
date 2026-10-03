import { BPS_DENOMINATOR, DECIMALS, ONE_USD6 } from "@senryo/core";

/** Money is integer base units (CLAUDE.md). Web display aliases over `@senryo/core` units. */
export const USD6_DECIMALS = DECIMALS.usd6;
export const USD6_ONE = ONE_USD6;
export const BPS_ONE = BPS_DENOMINATOR;
/** Bps are a percent with two decimals: 82 bps → "0.82%". */
export const BPS_PERCENT_DECIMALS = DECIMALS.bpsAsPct;
export const LOCALE = "en-US";

/** Browser-kept money conveniences (per account and network; never money truth). */
export const MONEY_STORAGE = {
  hiddenTokens: "senryo.hidden-tokens.v1",
  homeTab: "senryo.home-tab.v1",
  destinations: "senryo.destinations.v1",
  /** B4: the open deposit address issued per route, kept so a reload shows the same address and its timeline. */
  depositAddresses: "senryo.deposit-addresses.v1",
  /** B4/B16: inbound money this browser started that hasn't landed yet ("Arriving"). */
  arrivals: "senryo.arrivals.v1",
} as const;
/** "Copied" stays on a Copy circle this long. */
export const COPIED_MS = 1_600;
