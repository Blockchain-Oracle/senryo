/**
 * The swap's words and figures (B6): the rate per one paid token, the judged impact, the route's hops, the network fee
 * in MON, and the impact rule's block size estimate. Integer maths only (bigint units, bps).
 */
import type { SwapQuoteOk } from "@senryo/api-client";
import { IMPACT_BLOCK_BPS } from "@senryo/core";
import { finePct, tokenAmount } from "@/lib/money/format";

const TEN = 10n;
const MON_DECIMALS = 18;
/** The block-size estimate aims this share (bps of 10 000) below the linear bound, so the re-quote passes. */
const MAX_SIZE_MARGIN_BPS = 9_000n;
const BPS = 10_000n;

const PROVIDER_NAME: Record<SwapQuoteOk["quote"]["provider"], string> = {
  monorail: "Monorail",
  kyberswap: "KyberSwap",
};

export function swapProviderName(provider: SwapQuoteOk["quote"]["provider"]): string {
  return PROVIDER_NAME[provider];
}

/** "1 USDC = 0.000204 XAUt0". */
export function rateText(q: SwapQuoteOk): string {
  if (q.amountIn === 0n) return "";
  const perOne = (q.quote.amountOut * TEN ** BigInt(q.from.decimals)) / q.amountIn;
  return `1 ${q.from.symbol} = ${tokenAmount(perOne, q.to.decimals, q.to.symbol)}`;
}

/** "impact 0.40%", or "impact unknown" when no figure exists (the rule then warns). */
export function impactText(q: SwapQuoteOk): string {
  const bps = q.quote.impactBps;
  if (bps === null) return "impact unknown";
  if (bps <= 0) return "no impact";
  return `impact ${finePct(BigInt(bps))}`;
}

/** "USDC → MON → XAUt0". */
export function hopsText(q: SwapQuoteOk): string {
  const route = q.quote.route;
  if (route.length === 0) return `${q.from.symbol} → ${q.to.symbol}`;
  const symbols = [route[0]?.fromSymbol ?? q.from.symbol, ...route.map((h) => h.toSymbol ?? "?")];
  return symbols.join(" → ");
}

/** "0.0123 MON" for a fee in wei. */
export function monFee(wei: bigint): string {
  return tokenAmount(wei, MON_DECIMALS, "MON");
}

/**
 * The largest size the 5 % rule would likely let through, from this quote's own impact (impact grows about linearly
 * with size on one pool): amount × 5 % / impact, 10 % under that. An estimate — the re-quote judges it.
 */
export function maxUnderBlock(q: SwapQuoteOk): bigint | undefined {
  const bps = q.quote.impactBps;
  if (bps === null || bps <= 0) return undefined;
  return (q.amountIn * IMPACT_BLOCK_BPS * MAX_SIZE_MARGIN_BPS) / (BigInt(bps) * BPS);
}
