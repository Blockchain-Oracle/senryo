/**
 * The client's slippage limit in price terms (D-300, R5.8), one rule for calls and rides: a signed open or close
 * accepts the price moving against it by the 99th percentile of a 2-second move (the fill prints a second after the
 * commit). R1 measured BTC 3, ETH 4.5 and SOL 5.5 bp; modelled here as 3.8 σ over 2 s from each market's realised
 * volatility (BTC 3.4, ETH 4.5, SOL 5.4 bp), never under 3 bp — so every market gets one, from the same rule.
 */
import { type MarketSpec, sigmaE8Of } from "./catalog.ts";

const SLIPPAGE_WINDOW_SEC = 2;
const SLIPPAGE_SIGMAS = 3.8;
/** Hundredths of a basis point: 1e-6 of the price. */
export const SLIP_ONE = 1_000_000n;
const E8 = 1e8;
const MIN_SLIP_E6 = 300;

/** The limit as a share of the price × 1e6 (300 = 3 bp). */
export function slippageE6(m: MarketSpec): bigint {
  const move = (sigmaE8Of(m) / E8) * Math.sqrt(SLIPPAGE_WINDOW_SEC) * SLIPPAGE_SIGMAS;
  return BigInt(Math.max(MIN_SLIP_E6, Math.round(move * Number(SLIP_ONE))));
}

/** The worst price a buyer (`up`) or seller accepts from `priceE8`. */
export function worstPriceE8(priceE8: bigint, slipE6: bigint, up: boolean): bigint {
  return (priceE8 * (up ? SLIP_ONE + slipE6 : SLIP_ONE - slipE6)) / SLIP_ONE;
}
