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

/** Signed ceil(a / b) for b > 0 (bigint `/` truncates toward 0). */
const signedCeilDiv = (a: bigint, b: bigint): bigint => {
  const q = a / b;
  return a % b !== 0n && a > 0n ? q + 1n : q;
};

export interface PerplLiquidationInput extends PerplScale {
  side: PerplSide;
  entryPricePNS: bigint;
  lots: bigint;
  /** Collateral held by the position (`depositCNS`). */
  depositCNS: bigint;
  /** Funding booked to the position so far (`premiumPnlCNS`, signed; positive = received). */
  premiumPnlCNS: bigint;
  /** `getMarginFractions().perpMaintMarginFracHdths` (2500 = 4 % maintenance). */
  maintMarginFracHdths: bigint;
}

/**
 * The position's liquidation price (PNS), as Perpl computes it — dex-sdk `state/position.rs` `liquidation_price`
 * (MIT) and Perpl docs exchange/liquidation "Calculating Liquidation Price":
 *   P_liq = P_entry + s · (MMR − deposit − premiumPnl) / L,   MMR = P_entry · L / MMF,   s = +1 long, −1 short.
 * Integer units throughout; the MMR is rounded up and the move toward the entry, so the estimate is never further
 * from the mark than the exchange's own. Null when there is none above 0 (a long holding more than it owes).
 */
export function perplLiquidationPrice(input: PerplLiquidationInput): bigint | null {
  if (input.lots <= 0n || input.maintMarginFracHdths <= 0n) return null;
  const { num, den } = scaleFactor(input);
  const notional = perplNotional(input.lots, input.entryPricePNS, input);
  const mmr = ceilDiv(notional * oneUnit(PERPL_LEVERAGE_DECIMALS), input.maintMarginFracHdths);
  const gapCNS = mmr - input.depositCNS - input.premiumPnlCNS;
  // CNS over the position → a price move: the inverse of `perplNotional` (lots · price · den / num). Rounded up, so
  // both sides land on the entry's side of the exact value.
  const move = signedCeilDiv(gapCNS * num, input.lots * den);
  const price = input.side === "long" ? input.entryPricePNS + move : input.entryPricePNS - move;
  return price > 0n ? price : null;
}

/**
 * The liquidation price an open would start with, at most this close to the entry: Perpl books `notional ÷ leverage`
 * as the position's deposit plus whatever the fill loses against the mark (simulated 2 Oct 2026, perpl-plan-check), and
 * no funding yet — so with the lower bound P_liq = P_entry · (1 ± (1/MMF − 1/leverage)), the docs' "(IM − MM) ÷ (1 −
 * MM)" distance. Sized at the IOC's bound, the estimate never sits further from the mark than the real level.
 */
export function perplOpenLiquidationPrice(
  input: Omit<PerplLiquidationInput, "depositCNS" | "premiumPnlCNS"> & { leverageHdths: bigint },
): bigint | null {
  if (input.leverageHdths <= 0n) return null;
  const notional = perplNotional(input.lots, input.entryPricePNS, input);
  const depositCNS = (notional * oneUnit(PERPL_LEVERAGE_DECIMALS)) / input.leverageHdths;
  return perplLiquidationPrice({ ...input, depositCNS, premiumPnlCNS: 0n });
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
