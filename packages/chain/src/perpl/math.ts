/**
 * Perpl order maths in the Exchange's own integer units (no floats): prices in PNS (÷ 10^priceDecimals = USD), sizes in
 * LNS lots (÷ 10^lotDecimals = units of the asset), collateral in CNS (AUSD, 6 decimals).
 *
 * A "market" order is an IOC limit at mark ± slippage (Perpl docs, exchange/order-types.md "How a market order is
 * built"): a buy is bounded above the mark (rounded up), a sell below it (rounded down), so the bound never tightens
 * past what the user reviewed.
 */
import {
  PERPL_COLLATERAL_DECIMALS,
  PERPL_FEE_DENOMINATOR,
  PERPL_LEVERAGE_DECIMALS,
  PERPL_MAX_SLIPPAGE_BPS,
  PERPL_ORDER_TYPE,
  PERPL_PRICE_PNS_MAX,
  PERPL_PRICE_PNS_MIN,
  type PerplOrderType,
} from "@senryo/config";
import { BPS_DENOMINATOR, oneUnit } from "@senryo/core";

export type PerplSide = "long" | "short";
/** Open adds to (or starts) a position; close is reduce-only (`CloseLong` / `CloseShort`). */
export type PerplIntent = "open" | "close";
/** Which way the taker trades on the book: an open long or a close short buys. */
export type PerplTakerSide = "buy" | "sell";

export interface PerplScale {
  priceDecimals: number;
  lotDecimals: number;
}

/** The onchain order type for an intent on a side (0-based, `PERPL_ORDER_TYPE`). */
export function perplOrderType(intent: PerplIntent, side: PerplSide): PerplOrderType {
  if (intent === "open") return side === "long" ? PERPL_ORDER_TYPE.openLong : PERPL_ORDER_TYPE.openShort;
  return side === "long" ? PERPL_ORDER_TYPE.closeLong : PERPL_ORDER_TYPE.closeShort;
}

export function perplTakerSide(intent: PerplIntent, side: PerplSide): PerplTakerSide {
  return (intent === "open") === (side === "long") ? "buy" : "sell";
}

/** The order can't be built as asked (the chain would revert, or the app's policy refuses). */
export class PerplOrderError extends Error {
  constructor(
    readonly reason: "slippage" | "price-range" | "size" | "leverage",
    message: string,
  ) {
    super(message);
    this.name = "PerplOrderError";
  }
}

/** Integer ceil(a / b) for positive values. */
const ceilDiv = (a: bigint, b: bigint): bigint => (a + b - 1n) / b;

/**
 * The IOC's limit price: `markPNS` moved `slippageBps` against the taker (up for a buy, down for a sell). Refuses a
 * slippage above Perpl's market maximum and a price outside the 24-bit order range.
 */
export function perplLimitPrice(markPNS: bigint, taker: PerplTakerSide, slippageBps: bigint): bigint {
  if (slippageBps < 0n || slippageBps > PERPL_MAX_SLIPPAGE_BPS)
    throw new PerplOrderError("slippage", `slippage ${slippageBps} bps is outside 0…${PERPL_MAX_SLIPPAGE_BPS}`);
  const price =
    taker === "buy"
      ? ceilDiv(markPNS * (BPS_DENOMINATOR + slippageBps), BPS_DENOMINATOR)
      : (markPNS * (BPS_DENOMINATOR - slippageBps)) / BPS_DENOMINATOR;
  if (price < PERPL_PRICE_PNS_MIN || price > PERPL_PRICE_PNS_MAX)
    throw new PerplOrderError("price-range", `price ${price} is outside ${PERPL_PRICE_PNS_MIN}…${PERPL_PRICE_PNS_MAX}`);
  return price;
}

/** 10^(priceDecimals + lotDecimals − collateral decimals) as a numerator/denominator pair (decimals differ per market). */
function scaleFactor(scale: PerplScale): { num: bigint; den: bigint } {
  const exp = scale.priceDecimals + scale.lotDecimals - PERPL_COLLATERAL_DECIMALS;
  return exp >= 0 ? { num: oneUnit(exp), den: 1n } : { num: 1n, den: oneUnit(-exp) };
}

/** Notional (CNS) of `lots` at `pricePNS`, rounded down. */
export function perplNotional(lots: bigint, pricePNS: bigint, scale: PerplScale): bigint {
  const { num, den } = scaleFactor(scale);
  return (lots * pricePNS * den) / num;
}

/** Whole lots a notional (CNS) buys at `pricePNS`, rounded down (never more exposure than asked). */
export function perplLotsFor(notionalCNS: bigint, pricePNS: bigint, scale: PerplScale): bigint {
  if (pricePNS <= 0n) throw new PerplOrderError("price-range", "no price to size the order at");
  const { num, den } = scaleFactor(scale);
  return (notionalCNS * num) / (pricePNS * den);
}

export interface PerplMarginInput {
  /** Notional at the limit price (the worst the order can fill at). */
  notionalCNS: bigint;
  leverageHdths: bigint;
  /** `getTakerFee(perpId)`, millionths of notional. */
  takerFeePpm: bigint;
  slippageBps: bigint;
}

/**
 * Free collateral an open needs: initial margin (notional ÷ leverage) + the taker fee + the negative PnL a fill at the
 * slippage bound books against the mark (drawn from the account up to `maxNegPnlCollatBPS`). Rounded up throughout —
 * an estimate on the safe side, so a funded order is never short by a unit.
 */
export function perplMarginRequired(input: PerplMarginInput): bigint {
  if (input.leverageHdths <= 0n) throw new PerplOrderError("leverage", "leverage must be set explicitly");
  const margin = ceilDiv(input.notionalCNS * oneUnit(PERPL_LEVERAGE_DECIMALS), input.leverageHdths);
  const fee = ceilDiv(input.notionalCNS * input.takerFeePpm, PERPL_FEE_DENOMINATOR);
  const slip = ceilDiv(input.notionalCNS * input.slippageBps, BPS_DENOMINATOR);
  return margin + fee + slip;
}
