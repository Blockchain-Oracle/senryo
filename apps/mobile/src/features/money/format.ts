/**
 * Money words for any asset: amounts in the asset's own units (4 significant figures, cents at least), values in this
 * network's money (P$ in Practice), and the dollar assets' trading part. Integer maths only.
 */
import { MAINNET_CHAIN_ID } from "@senryo/config";
import { formatUnits } from "@senryo/core";
import { tokenAmount } from "~/features/tokens/format";
import { signedPct, usd } from "~/lib/money";
import type { MoneyAsset } from "./assets";

/** "12.50 AUSD", "0.0025 XAUt0". */
export function amountOf(asset: Pick<MoneyAsset, "decimals" | "symbol">, raw: bigint): string {
  return tokenAmount(raw, asset.decimals, asset.symbol);
}

/** The exact figure (every decimal the asset has, trailing zeros dropped) — for review rows and receipts. */
export function exactAmount(asset: Pick<MoneyAsset, "decimals" | "symbol">, raw: bigint): string {
  const text = formatUnits(raw, asset.decimals, asset.decimals);
  const trimmed = text.includes(".") ? text.replace(/0+$/, "").replace(/\.$/, "") : text;
  return `${trimmed} ${asset.symbol}`;
}

/** "$1,204.50" / "P$300.00" / "No price". */
export function valueText(asset: Pick<MoneyAsset, "valueUsd6">, chainId: number): string {
  if (asset.valueUsd6 === null) return "No price";
  return usd(asset.valueUsd6, undefined, chainId === MAINNET_CHAIN_ID ? "mainnet" : "testnet");
}

/** "+1.20%" from the holdings' signed bps, or undefined. */
export function changeText(bps: number | null): string | undefined {
  if (bps === null) return undefined;
  return signedPct(BigInt(bps));
}

/** The row's second line: amount, and the trading part of a dollar asset ("512.00 AUSD · 300.00 in trades"). */
export function holdingLine(asset: MoneyAsset): string {
  const base = amountOf(asset, asset.total);
  if (!asset.verified) return asset.lookalike ? `Not the listed ${asset.symbol}` : `${base} · Unverified`;
  if (asset.trading > 0n) return `${base} · ${tokenAmount(asset.trading, asset.decimals)} in trades`;
  return base;
}
