/**
 * Id helpers for callers that hold a network and a symbol rather than an address (collateral on the active network,
 * a Perpl market by ticker). They only build ids from the same constants the entity table is keyed by.
 */
import { MAINNET_CHAIN_ID, MAINNET_EXTERNAL } from "@senryo/config";
import { EXTERNAL_CHAIN_IDS, PERPL_MARKETS, PRACTICE_TOKENS, USDC_ELSEWHERE } from "./constants.ts";
import { CAIP2, type EntityId, ids } from "./ids.ts";

/** Networks a funding route names (Aurora sources and the Monad destination). */
export type RouteChain = "monad" | "base" | "ethereum" | "arbitrum" | "solana" | "bitcoin";

export const ROUTE_CHAIN_ID: Readonly<Record<RouteChain, EntityId>> = {
  monad: ids.evmChain(MAINNET_CHAIN_ID),
  base: ids.evmChain(EXTERNAL_CHAIN_IDS.base),
  ethereum: ids.evmChain(EXTERNAL_CHAIN_IDS.ethereum),
  arbitrum: ids.evmChain(EXTERNAL_CHAIN_IDS.arbitrum),
  solana: ids.caipChain(CAIP2.solana),
  bitcoin: ids.caipChain(CAIP2.bitcoin),
};

/** An asset on a route's network, or undefined when the registry doesn't key that pair (the mark then says so). */
export function routeAssetId(symbol: string, chain: RouteChain): EntityId | undefined {
  if (chain === "monad" && (symbol === "AUSD" || symbol === "USDC")) return collateralId(MAINNET_CHAIN_ID, symbol);
  if (symbol === "USDC" && chain === "solana") return ids.splToken(USDC_ELSEWHERE.solanaMint);
  if (symbol === "USDC" && (chain === "base" || chain === "ethereum" || chain === "arbitrum")) {
    return ids.token(EXTERNAL_CHAIN_IDS[chain], USDC_ELSEWHERE[chain]);
  }
  if (symbol === "ETH" && chain === "ethereum") return ids.native(EXTERNAL_CHAIN_IDS.ethereum, "ETH");
  if (symbol === "SOL" && chain === "solana") return ids.native(CAIP2.solana, "SOL");
  if (symbol === "BTC" && chain === "bitcoin") return ids.native(CAIP2.bitcoin, "BTC");
  return undefined;
}

export type Collateral = "AUSD" | "USDC";

/** AUSD / USDC on a Monad network: the real token on mainnet, the practice mock on testnet. */
export function collateralId(chainId: number, symbol: Collateral): EntityId {
  const book = chainId === MAINNET_CHAIN_ID ? MAINNET_EXTERNAL : PRACTICE_TOKENS;
  return ids.token(chainId, symbol === "AUSD" ? book.ausd : book.usdc);
}

/** A Perpl market on a network by ticker, or undefined when Perpl lists no such market there. */
export function perplMarketId(chainId: number, symbol: string): EntityId | undefined {
  const marketId = PERPL_MARKETS[chainId]?.[symbol];
  return marketId === undefined ? undefined : ids.perplMarket(chainId, marketId);
}
