/**
 * Money words for any asset (the phone's `features/money/format.ts` + `features/tokens/format.ts`): amounts in the
 * asset's own units to four significant figures (cents at least), values in this network's money (P$ in Practice), and
 * the dollar assets' trading part. Integer maths only — no floats on money, even for display.
 */
import { DECIMALS, formatUnits } from "@senryo/core";
import { money, signedPct } from "@/lib/format";
import type { MoneyAsset } from "./assets";

const SIGNIFICANT = 4;
const MAX_DECIMALS = 10;
const PRICE_DECIMALS = 18;
const TEN = 10n;

function decimalsFor(raw: bigint, unitDecimals: number): number {
  const abs = raw < 0n ? -raw : raw;
  if (abs === 0n || abs >= TEN ** BigInt(unitDecimals)) return DECIMALS.cents;
  const leadingZeros = unitDecimals - abs.toString().length;
  return Math.min(MAX_DECIMALS, unitDecimals, leadingZeros + SIGNIFICANT);
}

/** "0.0012 WBTC", "1,250.00 MON" from raw units. */
export function tokenAmount(raw: bigint, decimals: number, symbol?: string): string {
  const text = formatUnits(raw, decimals, Math.min(decimals, decimalsFor(raw, decimals)));
  return symbol ? `${text} ${symbol}` : text;
}

/** "$60,312.50", "$0.03189" from USD × 1e18. */
export function tokenPrice(priceUsd18: bigint): string {
  return `$${formatUnits(priceUsd18, PRICE_DECIMALS, decimalsFor(priceUsd18, PRICE_DECIMALS))}`;
}

/** "12.50 AUSD", "0.0025 XAUt0". */
export function amountOf(asset: Pick<MoneyAsset, "decimals" | "symbol">, raw: bigint): string {
  return tokenAmount(raw, asset.decimals, asset.symbol);
}

/** The exact figure (every decimal the asset has, trailing zeros dropped) — review rows and receipts. */
export function exactAmount(asset: Pick<MoneyAsset, "decimals" | "symbol">, raw: bigint): string {
  const text = formatUnits(raw, asset.decimals, asset.decimals);
  const trimmed = text.includes(".") ? text.replace(/0+$/, "").replace(/\.$/, "") : text;
  return `${trimmed} ${asset.symbol}`;
}

/** "P$300.00" / "No price". */
export function valueText(asset: Pick<MoneyAsset, "valueUsd6">): string {
  return asset.valueUsd6 === null ? "No price" : money(asset.valueUsd6);
}

/** "+1.20%" from the holdings' signed bps, or undefined. */
export function changeText(bps: number | null): string | undefined {
  return bps === null ? undefined : signedPct(BigInt(bps));
}

/** The row's second line: "512.00 AUSD · 300.00 in trades", "Unverified", "Not the listed WMON". */
export function holdingLine(asset: MoneyAsset): string {
  const base = amountOf(asset, asset.total);
  if (!asset.verified) return asset.lookalike ? `Not the listed ${asset.symbol}` : `${base} · Unverified`;
  if (asset.trading > 0n) return `${base} · ${tokenAmount(asset.trading, asset.decimals)} in trades`;
  return base;
}
