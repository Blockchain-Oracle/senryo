/**
 * The order stack's live words (R5.4, Codex direction 11 §2), one copy for both apps: a call's payouts per side
 * ("↑2.14× ↓1.86×") and the fees inside its prices ("$0.18–0.20 incl."), from the tick's open quotes; held, its fixed
 * payout and what cashing out costs now ("$0.14 to close").
 */
import { formatUnits, multiplierE2, type OpenQuote, P_ONE } from "@senryo/core";

const CENTS = 2;
const DOLLAR_DECIMALS = 6;
const ARROWS = ["↑", "↓"] as const;
const UNPRICED = "—";

const dollars = (v: bigint) => `$${formatUnits(v < 0n ? 0n : v, DOLLAR_DECIMALS, CENTS)}`;

/** "↑2.14× ↓1.86×" (one side for Range), "—" while neither has a price. */
export function paysWords(quotes: readonly (OpenQuote | null)[], stake: bigint): string {
  const parts = quotes.flatMap((q, i) =>
    q && !q.refusal
      ? [`${quotes.length > 1 ? ARROWS[i] : ""}${formatUnits(multiplierE2(stake, q.payout), CENTS, CENTS)}×`]
      : [],
  );
  return parts.length > 0 ? parts.join(" ") : UNPRICED;
}

/** The spread a stake pays inside each side's price ("$0.18–0.20 incl."): stake − shares × the fair chance. */
export function feesWords(quotes: readonly (OpenQuote | null)[], stake: bigint): string {
  const fees = quotes.flatMap((q) => (q && !q.refusal ? [stake - (q.payout * q.probE6) / P_ONE] : []));
  if (fees.length === 0) return UNPRICED;
  const lo = fees.reduce((a, b) => (b < a ? b : a));
  const hi = fees.reduce((a, b) => (b > a ? b : a));
  return lo === hi ? `${dollars(lo)} incl.` : `${dollars(lo)}–${formatUnits(hi, DOLLAR_DECIMALS, CENTS)} incl.`;
}

/** Held: what cashing out gives up to the spread now ("$0.14 to close"). */
export const closeCostWords = (fairNow: bigint, proceeds: bigint): string => `${dollars(fairNow - proceeds)} to close`;
