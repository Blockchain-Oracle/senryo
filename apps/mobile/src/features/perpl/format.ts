/**
 * Perpl numbers on screen, from the Exchange's own integer units (no floats): prices in PNS at the market's tick
 * ("$85,163.2"), sizes in lots as the base asset ("0.00023 BTC"), collateral in AUSD base units as real dollars.
 */
import { PERPL_LEVERAGE_DECIMALS } from "@senryo/config";
import { BPS_DENOMINATOR, DECIMALS, formatUnits, oneUnit } from "@senryo/core";
import { signedUsd, usd } from "~/lib/money";
import { PERPL_MONEY, type PerplMarketMeta } from "./market";

const E18 = 18;
const MON_SHOWN = 3;

/** "0.120 MON" from wei (network fees). */
export const monText = (wei: bigint) => `${formatUnits(wei, E18, MON_SHOWN)} MON`;
const LEVERAGE_UNIT = oneUnit(PERPL_LEVERAGE_DECIMALS);

/** "$85,163.2" — a Perpl price at its market's own tick. */
export function perplPrice(pns: bigint, meta: Pick<PerplMarketMeta, "priceDecimals">): string {
  return `$${formatUnits(pns, meta.priceDecimals, meta.priceDecimals)}`;
}

/** USD × 1e18 from PNS (for the shared chart and the `price18` helpers). */
export function perplPrice18(pns: bigint, meta: Pick<PerplMarketMeta, "priceDecimals">): bigint {
  return pns * oneUnit(E18 - meta.priceDecimals);
}

/** "0.00023 BTC" — lots as the base asset (flow book C5 step 3). */
export function perplSize(lots: bigint, meta: Pick<PerplMarketMeta, "lotDecimals" | "symbol">): string {
  return `${formatUnits(lots, meta.lotDecimals, meta.lotDecimals)} ${meta.symbol}`;
}

/** "$12.40" in real dollars whichever mode is selected (Perpl is mainnet money). */
export const perplUsd = (value6: bigint, shown: number = DECIMALS.cents) => usd(value6, shown, PERPL_MONEY);
export const perplSignedUsd = (value6: bigint) => signedUsd(value6, DECIMALS.cents, PERPL_MONEY);

/** 1500 hundredths → 15 (the ruler's whole steps; a fractional maximum rounds down). */
export const leverageX = (hdths: bigint): number => Number(hdths / LEVERAGE_UNIT);
export const leverageHdths = (x: number): bigint => BigInt(x) * LEVERAGE_UNIT;

/** Distance from `mark` to `liq` in bps of the mark, positive while the liquidation price hasn't been reached. */
export function liqDistanceBps(markPNS: bigint, liqPNS: bigint | null, side: "long" | "short"): bigint | null {
  if (liqPNS === null || markPNS <= 0n) return null;
  const gap = side === "long" ? markPNS - liqPNS : liqPNS - markPNS;
  return (gap * BPS_DENOMINATOR) / markPNS;
}

/** `ratePct100k` is in 1e-5 (100 = 0.1 %): percent = rate / 1000; one unit is 0.001 %. */
const FUNDING_PER_PERCENT = 1000;
const FUNDING_SHOWN = 3;
const SEC_PER_HOUR = 3600;
const SEC_PER_MINUTE = 60;

/** "8 h", "43 min" from seconds. */
function everyText(sec: number): string {
  return sec % SEC_PER_HOUR === 0 ? `${sec / SEC_PER_HOUR} h` : `${Math.round(sec / SEC_PER_MINUTE)} min`;
}

export interface FundingView {
  ratePct100k: number;
  intervalSec: { available: true; value: number } | { available: false; reason: string };
}

/** "0.010% per 8 h · longs pay" — the last applied rate, its interval when Perpl lists one, and who pays. */
export function fundingText(f: FundingView): string {
  const every = f.intervalSec.available ? ` per ${everyText(f.intervalSec.value)}` : " per interval";
  if (f.ratePct100k === 0) return `0%${every} · neither side pays`;
  const rate = `${(Math.abs(f.ratePct100k) / FUNDING_PER_PERCENT).toFixed(FUNDING_SHOWN)}%`;
  return `${rate}${every} · ${f.ratePct100k > 0 ? "longs pay" : "shorts pay"}`;
}

/** "You pay 0.010% per 8 h" / "You receive …" for the side being entered. */
export function fundingForSide(f: FundingView, side: "long" | "short"): string {
  const every = f.intervalSec.available ? ` per ${everyText(f.intervalSec.value)}` : " per interval";
  if (f.ratePct100k === 0) return `None now${every}`;
  const rate = `${(Math.abs(f.ratePct100k) / FUNDING_PER_PERCENT).toFixed(FUNDING_SHOWN)}%`;
  const pays = f.ratePct100k > 0 === (side === "long");
  return `You ${pays ? "pay" : "receive"} ${rate}${every}`;
}
