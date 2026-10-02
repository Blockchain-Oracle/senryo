/**
 * The asset a page is about (B2, routed by chain + address, never by symbol): the held row when the account has it
 * (amount, trading part, price), else the verified list's entry (zero balance), else the token's own `symbol()` /
 * `decimals()` read from the chain — an unknown token, shown with a monogram and "Unverified". Native MON is
 * `0x000…000`.
 */
import { readTokenMetadata } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import { ids } from "@senryo/identity";
import { useQueryEnv } from "@senryo/query";
import { useQuery } from "@tanstack/react-query";
import { bridgeAssetOf, collateralOf, isNativeAddress, type MoneyAsset } from "~/features/money/assets";
import { type MoneyAssets, useMoneyAssets } from "~/features/money/useMoneyAssets";
import { useTokenList } from "~/features/money/useTokenList";

const MON_DECIMALS = 18;
const METADATA_STALE_MS = 3_600_000;

/** Dollar-pegged tokens: no chart, and "≈ $1" is their price (B2: stablecoins have no chart). */
const STABLE_SYMBOLS = new Set(["AUSD", "USDC", "USDT0", "USDT", "GHO", "MUSD", "SYRUPUSDC", "USD1", "DAI"]);

export function isStable(asset: Pick<MoneyAsset, "symbol" | "collateral">): boolean {
  return asset.collateral !== undefined || STABLE_SYMBOLS.has(asset.symbol.toUpperCase());
}

function bare(chainId: ChainId, address: string, meta: { symbol: string; name: string; decimals: number }): MoneyAsset {
  const native = isNativeAddress(address);
  return {
    key: address.toLowerCase(),
    address: address as `0x${string}`,
    native,
    symbol: meta.symbol,
    name: meta.name,
    decimals: meta.decimals,
    mark: native ? ids.native(chainId, "MON") : ids.token(chainId, address),
    logoUrl: null,
    verified: native,
    lookalike: false,
    priceUsd18: null,
    change24hBps: null,
    wallet: 0n,
    trading: 0n,
    tradingFree: 0n,
    total: 0n,
    valueUsd6: null,
    collateral: collateralOf(chainId, address),
    bridge: bridgeAssetOf(chainId, address),
  };
}

export interface AssetPage {
  asset: MoneyAsset | undefined;
  /** Still reading which asset this is. */
  loading: boolean;
  failed: boolean;
  money: MoneyAssets;
}

export function useAsset(address: string): AssetPage {
  const env = useQueryEnv();
  const money = useMoneyAssets();
  const list = useTokenList();
  const held = money.find(address);
  const listed = list.data?.find((t) => t.key === address.toLowerCase());
  const native = isNativeAddress(address);
  const needChain = !held && !listed && !native && list.status !== "pending";
  const meta = useQuery({
    queryKey: ["token-meta", env.chainId, address.toLowerCase()],
    queryFn: async () => {
      const [m] = await readTokenMetadata(env.read, [address as `0x${string}`]);
      if (!m) throw new Error("not a token");
      return m;
    },
    enabled: needChain,
    staleTime: METADATA_STALE_MS,
  });
  const asset =
    held ??
    listed ??
    (native
      ? bare(env.chainId, address, { symbol: "MON", name: "Monad", decimals: MON_DECIMALS })
      : meta.data
        ? bare(env.chainId, address, meta.data)
        : undefined);
  return {
    asset,
    loading: asset === undefined && (money.status === "loading" || list.status === "pending" || meta.isLoading),
    failed: asset === undefined && meta.isError,
    money,
  };
}
