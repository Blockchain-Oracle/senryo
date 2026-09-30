import type { ChainId } from "@senryo/config";
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
};
