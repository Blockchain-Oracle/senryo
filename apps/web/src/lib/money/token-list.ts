"use client";

/**
 * Monad's verified token list (B6 "You receive": any verified token, searchable): the list the holdings service
 * verifies against (`TOKEN_LIST_URL`, matched by address), read once per session and shaped as zero-balance money rows
 * so the same picker shows it. Practice gets the testnet list (no swaps there; the ticket locks).
 */
import { type ChainId, TOKEN_LIST_URL } from "@senryo/config";
import { ids } from "@senryo/identity";
import { useQueryEnv } from "@senryo/query";
import { useQuery } from "@tanstack/react-query";
import { bridgeAssetOf, collateralOf, isNativeAddress, type MoneyAsset } from "./assets";

const TOKEN_LIST_STALE_MS = 3_600_000;

interface ListedToken {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
}

function listedAsset(chainId: ChainId, t: ListedToken): MoneyAsset {
  const native = isNativeAddress(t.address);
  return {
    key: t.address.toLowerCase(),
    address: t.address as `0x${string}`,
    native,
    symbol: t.symbol,
    name: t.name,
    decimals: t.decimals,
    mark: native ? ids.native(chainId, "MON") : ids.token(chainId, t.address),
    logoUrl: t.logoURI ?? null,
    verified: true,
    lookalike: false,
    priceUsd18: null,
    change24hBps: null,
    wallet: 0n,
    trading: 0n,
    tradingFree: 0n,
    total: 0n,
    valueUsd6: null,
    collateral: collateralOf(chainId, t.address),
    bridge: bridgeAssetOf(chainId, t.address),
  };
}

export function useTokenList() {
  const env = useQueryEnv();
  return useQuery({
    queryKey: ["token-list", env.chainId],
    queryFn: async ({ signal }) => {
      const res = await fetch(TOKEN_LIST_URL[env.chainId], { signal });
      if (!res.ok) throw new Error(`token list ${res.status}`);
      const body = (await res.json()) as { tokens?: ListedToken[] };
      return (body.tokens ?? []).filter((t) => t.chainId === env.chainId).map((t) => listedAsset(env.chainId, t));
    },
    staleTime: TOKEN_LIST_STALE_MS,
  });
}
