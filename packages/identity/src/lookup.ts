/**
 * Id helpers for callers that hold a network and a symbol rather than an address (the dollar on a network, a
 * prediction market by catalogue symbol). They only build ids from the same constants the entity table is keyed by.
 */
import { MAINNET_CHAIN_ID, MAINNET_USDC, TESTNET_CHAIN_ID } from "@senryo/config";
import { EXTERNAL_CHAIN_IDS, PRACTICE_DOLLAR, USDC_ELSEWHERE } from "./constants.ts";
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
  if (chain === "monad" && symbol === "USDC") return ids.token(MAINNET_CHAIN_ID, MAINNET_USDC);
  if (symbol === "USDC" && chain === "solana") return ids.splToken(USDC_ELSEWHERE.solanaMint);
  if (symbol === "USDC" && (chain === "base" || chain === "ethereum" || chain === "arbitrum")) {
    return ids.token(EXTERNAL_CHAIN_IDS[chain], USDC_ELSEWHERE[chain]);
  }
  if (symbol === "ETH" && chain === "ethereum") return ids.native(EXTERNAL_CHAIN_IDS.ethereum, "ETH");
  if (symbol === "SOL" && chain === "solana") return ids.native(CAIP2.solana, "SOL");
  if (symbol === "BTC" && chain === "bitcoin") return ids.native(CAIP2.bitcoin, "BTC");
  return undefined;
}

/** A prediction market's mark by catalogue symbol (`BTC`, `TSLA`, `XAU`, `EUR`). */
export function marketId(symbol: string): EntityId {
  if (symbol === "EUR") return ids.fxPair("EUR", "USD");
  return ["TSLA", "NVDA", "AAPL", "MSFT", "META", "AMZN", "GOOGL", "PLTR", "AMD", "QQQ", "SPY"].includes(symbol)
    ? ids.equity(symbol)
    : ids.market(symbol);
}

/** The dollar a network's calls use (R2.8): Test USD in Practice, USDC on Monad mainnet. */
export function dollarId(chainId: number): EntityId {
  return chainId === TESTNET_CHAIN_ID ? ids.token(chainId, PRACTICE_DOLLAR) : ids.token(chainId, MAINNET_USDC);
}
