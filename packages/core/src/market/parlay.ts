// A parlay's joint chance and quote (S8.5, D-293), line for line with `ParlayMath.chanceE6` and
// `ParlayBook._fillParlay`: within one asset class (a trading calendar) the legs' product floored at 85 % of the least
// likely of them, across classes the product, every rounding up; the spread and load surcharge once on top.
import { BPS, P_ONE, payoutFor } from "./band-math.ts";
import type { QuoteTerms } from "./band-quote.ts";

/** One leg: its band's probability × 1e6 at the fill print and its class (the market's calendar). */
export interface ParlayLegChance {
  probE6: bigint;
  group: number;
}

const ceilDiv = (a: bigint, b: bigint): bigint => (a === 0n ? 0n : (a - 1n) / b + 1n);

/** The joint chance × 1e6 (legs with probability 0 are dropped); `correlationBps` is config's `PARLAY`. */
export function parlayChanceE6(legs: readonly ParlayLegChance[], correlationBps: bigint): bigint {
  let chance = P_ONE;
  const done = new Set<number>();
  for (const [i, leg] of legs.entries()) {
    if (done.has(i) || leg.probE6 === 0n) continue;
    let joint = P_ONE;
    let least = P_ONE;
    let count = 0;
    for (const [j, other] of legs.entries()) {
      if (j < i || done.has(j) || other.probE6 === 0n || other.group !== leg.group) continue;
      done.add(j);
      joint = ceilDiv(joint * other.probE6, P_ONE);
      if (other.probE6 < least) least = other.probE6;
      count += 1;
    }
    if (count > 1) {
      const floor = ceilDiv(least * correlationBps, BPS);
      if (floor > joint) joint = floor;
    }
    chance = ceilDiv(chance * joint, P_ONE);
  }
  return chance;
}

export interface ParlayQuote {
  chanceE6: bigint;
  /** The joint chance plus the spread and surcharge: the price of a $1 payout. */
  priceE6: bigint;
  /** What the stake pays if every leg comes true; 0 when refused. */
  payout: bigint;
  refusal: "price" | null;
}

/** A parlay of `stake` on these legs — refused exactly where the contract would refuse it for price. */
export function quoteParlay(
  legs: readonly ParlayLegChance[],
  stake: bigint,
  t: QuoteTerms,
  correlationBps: bigint,
): ParlayQuote {
  const outOfBand = legs.some((l) => l.probE6 < t.minProbE6 || l.probE6 > t.maxProbE6);
  const chanceE6 = parlayChanceE6(legs, correlationBps);
  const priceE6 = chanceE6 + t.halfSpreadE6 + t.surchargeE6;
  const payout = priceE6 < P_ONE ? payoutFor(stake, priceE6) : 0n;
  const refused = outOfBand || chanceE6 < t.minProbE6 || priceE6 >= P_ONE || payout <= stake;
  return { chanceE6, priceE6, payout: refused ? 0n : payout, refusal: refused ? "price" : null };
}
