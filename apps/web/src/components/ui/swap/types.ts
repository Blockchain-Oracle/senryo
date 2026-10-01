// 21st: starc007/be-ui-multi-chain-swap (#16251) — https://21st.dev/@starc007/components/be-ui-multi-chain-swap
import {
  DISPLAY_LARGE_DIGITS,
  DISPLAY_SMALL_DIGITS,
  DISPLAY_THOUSAND,
  DISPLAY_TINY,
  DISPLAY_UNIT,
} from "@/lib/constants/swap";

export type TokenSide = "from" | "to";

export interface Chain {
  id: string;
  name: string;
  shortName: string;
  /** Canonical network id (`@senryo/identity`), drawn as the token's network badge. */
  entity: string;
}

export interface Token {
  id: string;
  chainId: string;
  symbol: string;
  name: string;
  /** Display-only sample balance (real balances are bigint base units, wired in S8). */
  balance: number;
  usd: number;
  /** Canonical asset id (`@senryo/identity`): its real mark, or a labelled fallback when the pair isn't keyed. */
  entity: string | undefined;
}

/** Quote rows shown under the fields; the real quote comes from the Aurora client in S8. */
export interface SwapQuote {
  feeUsd: number;
  slippagePct: number;
  eta: string;
}

export function formatAmount(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "0";
  if (value < DISPLAY_TINY) return `<${DISPLAY_TINY}`;
  if (value < DISPLAY_UNIT) return value.toFixed(DISPLAY_SMALL_DIGITS);
  const digits = value < DISPLAY_THOUSAND ? DISPLAY_SMALL_DIGITS : DISPLAY_LARGE_DIGITS;
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

/** Parses the free-text amount field; anything unparsable is 0. */
export function parseDecimal(text: string): number {
  const n = Number.parseFloat(text);
  return Number.isFinite(n) ? n : 0;
}

export function findById<T extends { id: string }>(items: readonly T[], id: string): T | undefined {
  return items.find((item) => item.id === id);
}
