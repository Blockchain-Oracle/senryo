/** Fixture values for the targeted checks (named, so every number says what it is). */
import { ONE_USD6 } from "@senryo/core";

const usd = (dollars: bigint) => dollars * ONE_USD6;

/** usd6 amounts used across the checks, relative to the session caps in src/constants.ts. */
export const USD = {
  one: usd(1n),
  ten: usd(10n),
  forty: usd(40n),
  fortyNine: usd(49n),
  fifty: usd(50n),
  sixty: usd(60n),
  hundred: usd(100n),
  twoHundred: usd(200n),
  /** One dollar over SESSION_TRADE_CAP_USD6. */
  overTradeCap: usd(251n),
  threeHundred: usd(300n),
  fiveHundred: usd(500n),
  thousand: usd(1_000n),
  fiveThousand: usd(5_000n),
  tenThousand: usd(10_000n),
} as const;

export const NOW_MS = 1_800_000_000_000;
export const DEADLINE_S = 2_000_000_000n;
export const PRICE_E18 = 10n ** 18n;
export const MARKET_XAU = 0;
export const GAS = 450_000n;
export const FEE_WEI = 1_000_000_000n;
export const HASH_BYTES = 32;
export const SIWE_NONCE = "abcdefgh12";
export const TRIGGER_SALT = 1n;
