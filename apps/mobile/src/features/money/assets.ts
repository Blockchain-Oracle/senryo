/**
 * The any-asset model every money surface shares (flow book B0.1, B1; plan §0.4 symmetry rule): one row per token at
 * the account's address — native MON, every listed ERC-20, every unknown one — with the dollar assets' trading-account
 * part folded in, so AUSD shows once ("512.00 · 300 in trades") and counts once. Verified means the token list knows
 * its ADDRESS (or it is this network's own collateral); an unverified token has no price and never counts in a total.
 * Pure: the hook that reads it lives in `useMoneyAssets.ts`.
 */
import type { Holding } from "@senryo/api-client";
import {
  type BridgeAsset,
  type ChainId,
  MAINNET_CHAIN_ID,
  MONAD_BRIDGE_ASSETS,
  NATIVE_TOKEN,
  SENDER_RESERVE_MON,
} from "@senryo/config";
import { ONE_E18 } from "@senryo/core";
import { collateralId, entity, ids } from "@senryo/identity";
import { type CollateralSymbol, collateralTokenOf } from "@senryo/query";

const TEN = 10n;
/** USD × 1e18 → usd6: twelve decimals apart. */
const USD18_TO_USD6_DECIMALS = 12n;
const USD18_PER_USD6 = TEN ** USD18_TO_USD6_DECIMALS;
const USD6_DECIMALS = 6;

export interface MoneyAsset {
  /** Lower-case address; `0x000…000` for native MON. */
  key: string;
  address: `0x${string}`;
  native: boolean;
  symbol: string;
  name: string;
  decimals: number;
  /** `@senryo/identity` entity id; `logoUrl` draws it when the registry has no art. */
  mark: string;
  logoUrl: string | null;
  verified: boolean;
  /** Unverified, with a listed token's symbol (a fake "WMON"). */
  lookalike: boolean;
  priceUsd18: bigint | null;
  change24hBps: number | null;
  /** Raw units in the wallet. */
  wallet: bigint;
  /** Raw units in the trading account (AUSD / USDC only). */
  trading: bigint;
  /** The part of `trading` that can leave now (min(balance, Free to trade)). */
  tradingFree: bigint;
  total: bigint;
  /** total × price; dollars at their peg where no price is served (Practice); null when unpriced. */
  valueUsd6: bigint | null;
  collateral: CollateralSymbol | undefined;
  /** One of the five bridgeable assets on this network, by address. */
  bridge: BridgeAsset | undefined;
}

export function isNativeAddress(address: string): boolean {
  return address.toLowerCase() === NATIVE_TOKEN.toLowerCase();
}

/** Raw units × USD-per-token (1e18) → usd6, rounded down. */
export function valueOfUnits(amount: bigint, decimals: number, priceUsd18: bigint): bigint {
  return (amount * priceUsd18) / (TEN ** BigInt(decimals) * USD18_PER_USD6);
}

/** usd6 → raw units at a USD-per-token price (1e18), rounded down: the $ ↔ units toggle. */
export function unitsOfValue(usd6: bigint, decimals: number, priceUsd18: bigint): bigint {
  if (priceUsd18 === 0n) return 0n;
  return (usd6 * TEN ** BigInt(decimals) * USD18_PER_USD6) / priceUsd18;
}

/** A dollar at its peg (6-decimal stable) in usd6, for Practice where no prices exist. */
function pegValue(amount: bigint, decimals: number): bigint {
  return decimals >= USD6_DECIMALS
    ? amount / TEN ** BigInt(decimals - USD6_DECIMALS)
    : amount * TEN ** BigInt(USD6_DECIMALS - decimals);
}

export function bridgeAssetOf(chainId: ChainId, address: string): BridgeAsset | undefined {
  if (isNativeAddress(address)) return MONAD_BRIDGE_ASSETS[chainId]?.MON ? "MON" : undefined;
  const book = MONAD_BRIDGE_ASSETS[chainId] ?? {};
  for (const [asset, token] of Object.entries(book)) {
    if (token && token.address.toLowerCase() === address.toLowerCase()) return asset as BridgeAsset;
  }
  return undefined;
}

export function collateralOf(chainId: ChainId, address: string): CollateralSymbol | undefined {
  const lower = address.toLowerCase();
  if (collateralTokenOf(chainId, "AUSD").toLowerCase() === lower) return "AUSD";
  if (collateralTokenOf(chainId, "USDC").toLowerCase() === lower) return "USDC";
  return undefined;
}

export interface TradingPart {
  ausd: bigint;
  usdc: bigint;
  /** Free to trade (≥ 0): what of the trading part may leave. */
  free: bigint;
}

/** One holding (from `/v1/holdings`) → a money row, with the trading part folded into the dollar assets. */
export function assetOf(chainId: ChainId, h: Holding, trading: TradingPart | undefined): MoneyAsset {
  const collateral = collateralOf(chainId, h.address);
  const tradingUnits = collateral && trading ? (collateral === "AUSD" ? trading.ausd : trading.usdc) : 0n;
  const free = trading ? (tradingUnits < trading.free ? tradingUnits : trading.free) : 0n;
  const total = h.balance + tradingUnits;
  const ownCollateral = collateral !== undefined;
  const mark = ownCollateral ? collateralId(chainId, collateral) : h.native ? ids.native(chainId, "MON") : h.mark;
  const price = h.priceUsd18;
  const valueUsd6 =
    price !== null
      ? valueOfUnits(total, h.decimals, price)
      : ownCollateral && chainId !== MAINNET_CHAIN_ID
        ? pegValue(total, h.decimals)
        : null;
  return {
    key: h.address.toLowerCase(),
    address: h.address as `0x${string}`,
    native: h.native,
    symbol: h.symbol,
    name: ownCollateral ? (entity(mark)?.name ?? h.name) : h.name,
    decimals: h.decimals,
    mark,
    logoUrl: h.logoUrl,
    verified: h.verified || ownCollateral,
    lookalike: h.lookalike && !ownCollateral,
    priceUsd18: price,
    change24hBps: h.change24hBps,
    wallet: h.balance,
    trading: tradingUnits,
    tradingFree: free,
    total,
    valueUsd6,
    collateral,
    bridge: bridgeAssetOf(chainId, h.address),
  };
}

/** A dollar asset the wallet doesn't hold but the trading account does (it never shows in `/v1/holdings`). */
export function tradingOnlyAsset(chainId: ChainId, symbol: CollateralSymbol, trading: TradingPart): MoneyAsset {
  const address = collateralTokenOf(chainId, symbol);
  return assetOf(
    chainId,
    {
      address,
      native: false,
      symbol,
      name: symbol,
      decimals: USD6_DECIMALS,
      balance: 0n,
      verified: true,
      lookalike: false,
      mark: collateralId(chainId, symbol),
      logoUrl: null,
      priceUsd18: chainId === MAINNET_CHAIN_ID ? ONE_E18 : null,
      valueUsd6: null,
      change24hBps: null,
      priceSource: null,
    },
    trading,
  );
}

/** Sort: priced value desc → verified unpriced → symbol (B1). */
export function byValue(a: MoneyAsset, b: MoneyAsset): number {
  const av = a.valueUsd6 ?? -1n;
  const bv = b.valueUsd6 ?? -1n;
  if (av !== bv) return av > bv ? -1 : 1;
  return a.symbol.localeCompare(b.symbol);
}

/** MON kept on the account by a value send (Monad's 10 MON floor for delegated accounts, B11). */
export const MON_RESERVE_WEI = SENDER_RESERVE_MON * ONE_E18;

/** Room left for the send's own network fee on top of the reserve (Monad fees run ~0.002 MON a transfer). */
const MON_FEE_ALLOWANCE_DECIMALS = 16n;
export const MON_FEE_ALLOWANCE_WEI = TEN ** MON_FEE_ALLOWANCE_DECIMALS;

/** What a send of this asset can move: the wallet (MON less the reserve and its fee) plus the free trading part. */
export function spendableOf(asset: MoneyAsset, feeWei = MON_FEE_ALLOWANCE_WEI): bigint {
  if (asset.native) {
    const free = asset.wallet - MON_RESERVE_WEI - feeWei;
    return free > 0n ? free : 0n;
  }
  return asset.wallet + asset.tradingFree;
}

/** Search across symbol, name and pasted address. */
export function matchesQuery(asset: Pick<MoneyAsset, "symbol" | "name" | "key">, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  return asset.symbol.toLowerCase().includes(q) || asset.name.toLowerCase().includes(q) || asset.key === q;
}
