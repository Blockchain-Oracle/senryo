/**
 * Markets → Tokens (J11; Fomo F10; plan §0.9 Markets): Monad's verified spot tokens with a live pool, as row data for
 * the Markets list. Tokens you hold lead, with what they're worth, then the list's order; Trending orders by 24 h
 * volume and Gainers by 24 h change. Prices are the pools' mid prices onchain; the 24 h change and volume are
 * GeckoTerminal's. The pools live on Monad mainnet, so Practice shows the same real prices.
 */
import { spotValueUsd6 } from "@senryo/chain";
import { SPOT_TOKENS, type SpotToken } from "@senryo/config";
import { useTokenHoldings, useTokenPrices, useTokenStats } from "@senryo/query";
import { useAccount } from "~/lib/account/provider";

export const TOKEN_SORTS = [
  { value: "all", label: "All" },
  { value: "trending", label: "Trending" },
  { value: "gainers", label: "Gainers" },
] as const;
export type TokenSort = (typeof TOKEN_SORTS)[number]["value"];

export interface TokenRowData {
  token: SpotToken;
  /** Undefined while loading; null when a hop has no live pool. */
  priceUsd18: bigint | null | undefined;
  change24hBps: bigint | undefined;
  held: { balance: bigint; valueUsd6: bigint | undefined } | undefined;
  volume24hUsd: number | undefined;
}

/** Larger first, exact on bigints (no float conversion). */
const descending = (a: bigint, b: bigint) => (a < b ? 1 : a > b ? -1 : 0);

export function useTokenRows(sort: TokenSort): TokenRowData[] {
  const address = useAccount().hint?.address;
  const prices = useTokenPrices();
  const stats = useTokenStats();
  const holdings = useTokenHoldings(address);
  const priceOf = (symbol: string): bigint | null | undefined => {
    if (prices.status !== "fresh" && prices.status !== "stale") return prices.status === "failed" ? null : undefined;
    return prices.value.find((p) => p.token.symbol === symbol)?.priceUsd18 ?? null;
  };
  const statsOf = (symbol: string) =>
    stats.status === "fresh" || stats.status === "stale" ? stats.value.get(symbol) : undefined;
  const heldOf = (symbol: string) => {
    if (holdings.status !== "fresh" && holdings.status !== "stale") return undefined;
    const h = holdings.value.find((x) => x.token.symbol === symbol);
    if (!h || h.balance === 0n) return undefined;
    const price = priceOf(symbol);
    return { balance: h.balance, valueUsd6: price ? spotValueUsd6(h.balance, h.token.decimals, price) : undefined };
  };
  const rows: TokenRowData[] = SPOT_TOKENS.map((token) => ({
    token,
    priceUsd18: priceOf(token.symbol),
    change24hBps: statsOf(token.symbol)?.change24hBps,
    held: heldOf(token.symbol),
    volume24hUsd: statsOf(token.symbol)?.volume24hUsd,
  }));
  if (sort === "trending") return [...rows].sort((a, b) => (b.volume24hUsd ?? -1) - (a.volume24hUsd ?? -1));
  if (sort === "gainers") {
    return rows
      .filter((r) => r.change24hBps !== undefined && r.change24hBps > 0n)
      .sort((a, b) => descending(a.change24hBps ?? 0n, b.change24hBps ?? 0n));
  }
  const worth = (r: TokenRowData) => r.held?.valueUsd6 ?? 0n;
  const held = rows.filter((r) => r.held !== undefined).sort((a, b) => descending(worth(a), worth(b)));
  return [...held, ...rows.filter((r) => r.held === undefined)];
}
