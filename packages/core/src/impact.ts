/**
 * The generic swap price-impact rule (plan §0.7 #5, B6): every swap — any token, any route — warns above 1 % and is
 * blocked above 5 %. It replaces the gold-only caps. Impact is measured against an independent reference price when
 * one exists (the XAU feed for XAUt0, the market price for other tokens); an aggregator's own figure is only the
 * fallback, because thin pools make aggregators disagree (XAUt0 on 2 Oct: $3,948 vs $4,189 vs a $4,181 feed).
 */
import { BPS_DENOMINATOR } from "./money/units.ts";

/** Above this the review warns (bps). */
export const IMPACT_WARN_BPS = 100n;
/** Above this the swap is blocked (bps). */
export const IMPACT_BLOCK_BPS = 500n;

export type ImpactLevel = "ok" | "warn" | "block";

/** `ok` up to 1 %, `warn` above 1 %, `block` above 5 %. A negative impact (better than the reference) is `ok`. */
export function priceImpactRule(bps: bigint): ImpactLevel {
  if (bps > IMPACT_BLOCK_BPS) return "block";
  if (bps > IMPACT_WARN_BPS) return "warn";
  return "ok";
}

/**
 * Signed impact of a trade from its two reference values in the same unit (e.g. usd6): (in − out) / in in bps.
 * Positive = the trade returns less than it costs at the reference; negative = better than the reference.
 */
export function impactBpsOf(valueIn: bigint, valueOut: bigint): bigint {
  if (valueIn <= 0n) throw new RangeError("impactBpsOf: the input value must be positive");
  return ((valueIn - valueOut) * BPS_DENOMINATOR) / valueIn;
}

export type ImpactSource = "reference" | "provider";

/** The impact a review shows and the rule judges: the reference figure when present, else the provider's. */
export function judgedImpact(
  referenceBps: bigint | null,
  providerBps: bigint | null,
): { bps: bigint | null; source: ImpactSource | null; level: ImpactLevel } {
  if (referenceBps !== null) return { bps: referenceBps, source: "reference", level: priceImpactRule(referenceBps) };
  if (providerBps !== null) return { bps: providerBps, source: "provider", level: priceImpactRule(providerBps) };
  // No figure at all: the review states it and warns, never passes it silently as "ok".
  return { bps: null, source: null, level: "warn" };
}
