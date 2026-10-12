/**
 * A call's slippage limit in price terms (D-300, R5.8), the rule rides use: what the open still pays — or the cash-out
 * still returns — if the price moves against it by the p99 of a 2-second move (`slippageE6`, by market) before the
 * fill print a second later. Both directions are tried and the worse taken, so Range (which loses either way) is
 * covered too. Replaces 3 % of the quote: refusals fall from 7–15 % to about 1 %.
 */
import { SLIP_ONE } from "@senryo/config";
import { type BandShape, type QuoteTerms, type QuoteWindow, quoteClose, quoteOpen } from "@senryo/core";

const moved = (spot: bigint, slipE6: bigint) =>
  [(spot * (SLIP_ONE + slipE6)) / SLIP_ONE, (spot * (SLIP_ONE - slipE6)) / SLIP_ONE] as const;

const least = (a: bigint, b: bigint) => (a < b ? a : b);

/**
 * The least payout an open of `stake` accepts; a side of the move the pool would refuse (past its bounds) is left
 * out, and null when both are — the caller then keeps its tolerance on the quote.
 */
export function openLimit(
  band: BandShape,
  w: QuoteWindow,
  spot: bigint,
  stake: bigint,
  terms: QuoteTerms,
  slipE6: bigint,
): bigint | null {
  const payouts = moved(spot, slipE6).flatMap((p) => {
    const q = quoteOpen(band, w, p, stake, terms);
    return q.refusal ? [] : [q.payout];
  });
  return payouts.length === 0 ? null : payouts.reduce(least);
}

/** The least a cash-out of `shares` accepts (null when the pool would refuse it on both sides of the move). */
export function closeLimit(
  band: BandShape,
  w: QuoteWindow,
  spot: bigint,
  shares: bigint,
  terms: QuoteTerms,
  slipE6: bigint,
): bigint | null {
  const proceeds = moved(spot, slipE6).flatMap((p) => {
    const q = quoteClose(band, w, p, shares, terms);
    return q.refusal ? [] : [q.proceeds];
  });
  return proceeds.length === 0 ? null : proceeds.reduce(least);
}
