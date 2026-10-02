import { type ChainId, MAINNET_CHAIN_ID } from "@senryo/config";
import type { Address } from "@senryo/core";

/**
 * Query keys (specs/client.md "Data flow"). Every key starts with its domain and chain so a finalized account event
 * invalidates exactly `["account", chainId, address]` and a network switch never mixes practice and mainnet data.
 */
export const keys = {
  market: (chainId: ChainId, marketId: number) => ["market", chainId, marketId] as const,
  marketRisk: (chainId: ChainId, marketId: number) => ["market", chainId, marketId, "risk"] as const,
  calendar: (chainId: ChainId, calendarId: number) => ["market", chainId, "calendar", calendarId] as const,
  candles: (feedChainId: ChainId, symbol: string, interval: number) =>
    ["market", feedChainId, "candles", symbol, interval] as const,
  account: (chainId: ChainId, address: Address) => ["account", chainId, address.toLowerCase()] as const,
  accountRisk: (chainId: ChainId, address: Address, tag: "latest" | "finalized") =>
    ["account", chainId, address.toLowerCase(), "risk", tag] as const,
  positions: (chainId: ChainId, address: Address) => ["account", chainId, address.toLowerCase(), "positions"] as const,
  gas: (chainId: ChainId, address: Address) => ["account", chainId, address.toLowerCase(), "gas"] as const,
  activity: (chainId: ChainId, address: Address) => ["account", chainId, address.toLowerCase(), "activity"] as const,
  /** Under the account key: one invalidation after a claim refreshes the claim state, buckets and gas together. */
  starter: (chainId: ChainId, address: Address) => ["account", chainId, address.toLowerCase(), "starter"] as const,
  /** Deposit inbox (S8.24): its balance + the api watch, refreshed with the account after a sweep. */
  inbox: (chainId: ChainId, address: Address) => ["account", chainId, address.toLowerCase(), "inbox"] as const,
  /** J11 spot tokens: mainnet-only pools, so the chain in these keys is always 143 whichever network is selected. */
  spotPrices: (tokens: string) => ["spot", MAINNET_CHAIN_ID, "prices", tokens] as const,
  spotQuote: (symbol: string, side: string, amountIn: string, slippageBps: string) =>
    ["spot", MAINNET_CHAIN_ID, "quote", symbol, side, amountIn, slippageBps] as const,
  spotCandles: (symbol: string, interval: number) => ["spot", MAINNET_CHAIN_ID, "candles", symbol, interval] as const,
  spotStats: (tokens: string) => ["spot", MAINNET_CHAIN_ID, "stats", tokens] as const,
  /** Read-only discovery (S03): mainnet data in either mode, so the chain is always 143. */
  discoveryQuotes: (group: "perpl" | "feeds", ids: string) =>
    ["discovery", MAINNET_CHAIN_ID, "quotes", group, ids] as const,
  discoveryCandles: (id: string, interval: number) => ["discovery", MAINNET_CHAIN_ID, "candles", id, interval] as const,
  /** Perpl (D1): mainnet only; the wallet's account sits under the 143 account key (a finalized send refreshes it). */
  perpl: (address: Address) => ["account", MAINNET_CHAIN_ID, address.toLowerCase(), "perpl"] as const,
  perplMarket: (marketId: number) => ["perpl", MAINNET_CHAIN_ID, "market", marketId] as const,
  perplExchange: () => ["perpl", MAINNET_CHAIN_ID, "exchange"] as const,
  /** Under the mainnet account key, so a finalized swap's account invalidation refreshes the holdings. */
  spotHoldings: (address: Address, tokens: string) =>
    ["account", MAINNET_CHAIN_ID, address.toLowerCase(), "spot", tokens] as const,
};
