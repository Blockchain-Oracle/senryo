"use client";

/**
 * Every asset the account holds (B1, plan §0.4): `/v1/holdings` (any token at the address, verified by address, priced
 * on Mainnet) joined with the trading account's AUSD / USDC, so each dollar asset is one row and counts once (BD-1).
 * When the holdings service can't be reached, the dollar assets and MON still come from the chain, and the list says
 * other tokens are missing — never a fake $0. Practice values its dollars at the peg and MON at "No price". Ported
 * from the phone (`features/money/useMoneyAssets.ts`).
 */
import type { Holding } from "@senryo/api-client";
import { isDeployed } from "@senryo/chain";
import { MAINNET_CHAIN_ID, NATIVE_TOKEN } from "@senryo/config";
import { type Address, type Diagnosis, ONE_E18 } from "@senryo/core";
import { collateralId, ids } from "@senryo/identity";
import {
  anyAssetKeys,
  collateralTokenOf,
  keys,
  useAccountRisk,
  useGasBalance,
  useHoldings,
  useQueryEnv,
  useWalletCollateral,
} from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { assetOf, byValue, type MoneyAsset, type TradingPart, tradingOnlyAsset } from "./assets";
import { useHiddenTokens } from "./hidden";

const MON_DECIMALS = 18;
const DOLLAR_DECIMALS = 6;

export interface MoneyAssets {
  status: "loading" | "ready" | "failed";
  /** Verified, not hidden, by value. */
  assets: MoneyAsset[];
  /** Unverified, not hidden ("Other tokens"). */
  other: MoneyAsset[];
  hidden: MoneyAsset[];
  /** Σ value of verified priced rows (incl. the trading part). */
  totalUsd6: bigint;
  /** A verified row has no price, or some tokens couldn't be discovered. */
  partial: boolean;
  /** The holdings service failed: the rows come from the chain only (dollars + MON). */
  degraded: boolean;
  stale: boolean;
  error: Diagnosis | undefined;
  trading: TradingPart | undefined;
  /** Raw MON in the wallet (fees), when known. */
  monWei: bigint | undefined;
  retry: () => void;
  find: (address: string) => MoneyAsset | undefined;
}

function holding(partial: Pick<Holding, "address" | "symbol" | "name" | "decimals" | "balance" | "native">): Holding {
  return {
    ...partial,
    verified: true,
    lookalike: false,
    mark: "",
    logoUrl: null,
    priceUsd18: null,
    valueUsd6: null,
    change24hBps: null,
    priceSource: null,
  };
}

/** `address` is the account to read (the signed-in one, or a watched one). */
export function useMoneyAssets(address: Address | undefined): MoneyAssets {
  const env = useQueryEnv();
  const client = useQueryClient();
  const coreReady = isDeployed(env.chainId, "SenryoCore");
  const holdings = useHoldings(address);
  const risk = useAccountRisk(coreReady ? address : undefined, "finalized");
  const walletDollars = useWalletCollateral(holdings.status === "failed" ? address : undefined);
  const gas = useGasBalance(address);
  const hidden = useHiddenTokens(env.chainId, address);

  const snapshot = risk.status === "fresh" || risk.status === "stale" ? risk.value : undefined;
  const trading: TradingPart | undefined = snapshot
    ? { ausd: snapshot.ausd, usdc: snapshot.usdc, free: snapshot.freeToTrade > 0n ? snapshot.freeToTrade : 0n }
    : undefined;
  const monWei = gas.status === "fresh" || gas.status === "stale" ? gas.value : undefined;
  const retry = () => {
    if (!address) return;
    void client.invalidateQueries({ queryKey: anyAssetKeys.holdings(env.chainId, address) });
    void client.invalidateQueries({ queryKey: keys.account(env.chainId, address) });
  };

  let rows: Holding[] | undefined;
  let complete = true;
  let degraded = false;
  if (holdings.status === "fresh" || holdings.status === "stale") {
    rows = holdings.value.tokens;
    complete = holdings.value.discovery.complete;
  } else if (holdings.status === "failed") {
    degraded = true;
    complete = false;
    const wallet =
      walletDollars.status === "fresh" || walletDollars.status === "stale" ? walletDollars.value : undefined;
    if (wallet || monWei !== undefined) {
      rows = [];
      for (const symbol of ["AUSD", "USDC"] as const) {
        const balance = wallet?.[symbol] ?? 0n;
        if (balance > 0n) {
          rows.push(
            holding({
              address: collateralTokenOf(env.chainId, symbol),
              symbol,
              name: symbol,
              decimals: DOLLAR_DECIMALS,
              balance,
              native: false,
            }),
          );
        }
      }
      if (monWei !== undefined && monWei > 0n) {
        rows.push(
          holding({
            address: NATIVE_TOKEN,
            symbol: "MON",
            name: "Monad",
            decimals: MON_DECIMALS,
            balance: monWei,
            native: true,
          }),
        );
      }
    }
  }

  const all: MoneyAsset[] = (rows ?? []).map((h) => {
    const asset = assetOf(env.chainId, h, trading);
    if (!degraded || !asset.collateral) return asset;
    // Chain-only fallback: a dollar is valued at its peg (the same estimate the portfolio read uses).
    return { ...asset, mark: collateralId(env.chainId, asset.collateral), valueUsd6: asset.total };
  });
  if (trading) {
    for (const symbol of ["AUSD", "USDC"] as const) {
      const part = symbol === "AUSD" ? trading.ausd : trading.usdc;
      if (part > 0n && !all.some((a) => a.collateral === symbol))
        all.push(tradingOnlyAsset(env.chainId, symbol, trading));
    }
  }
  for (const asset of all) {
    if (asset.native && asset.mark === "") asset.mark = ids.native(env.chainId, "MON");
  }
  const visible = all.filter((a) => !hidden.has(a.key));
  const assets = visible.filter((a) => a.verified).sort(byValue);
  const other = visible.filter((a) => !a.verified).sort((a, b) => a.symbol.localeCompare(b.symbol));
  const hiddenRows = all.filter((a) => hidden.has(a.key));
  const priced = assets.filter((a) => a.valueUsd6 !== null);
  const totalUsd6 = priced.reduce((sum, a) => sum + (a.valueUsd6 ?? 0n), 0n);
  // Practice has no prices: an unpriced MON there is "No price", not a missing source (B1 acceptance).
  const unpricedCounts = env.chainId === MAINNET_CHAIN_ID;
  const partial = !complete || (unpricedCounts && assets.some((a) => a.valueUsd6 === null && a.total > 0n));
  const loading = rows === undefined && holdings.status !== "failed" && address !== undefined;
  const failed = rows === undefined && holdings.status === "failed";
  return {
    status: loading || (!address && rows === undefined) ? "loading" : failed ? "failed" : "ready",
    assets,
    other,
    hidden: hiddenRows,
    totalUsd6,
    partial,
    degraded,
    stale: holdings.status === "stale",
    error: holdings.status === "failed" ? holdings.error : holdings.status === "stale" ? holdings.error : undefined,
    trading,
    monWei,
    retry,
    find: (key: string) => all.find((a) => a.key === key.toLowerCase()),
  };
}

/** A 1:1 dollar quote helper for amounts typed in $ on an asset that has no price (Practice dollars). */
export function pegPriceUsd18(asset: MoneyAsset): bigint | null {
  if (asset.priceUsd18 !== null) return asset.priceUsd18;
  return asset.collateral ? ONE_E18 : null;
}
