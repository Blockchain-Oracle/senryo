import type { ChainId } from "@senryo/config";
import type { Address } from "@senryo/core";

/**
 * Query keys (specs/client.md "Data flow"). Every key starts with its domain and chain so a finalized account event
 * invalidates exactly `["account", chainId, address]` and a network switch never mixes practice and mainnet data.
 * After the pivot (D-256) only the account key remains; positions, history and markets arrive with S4/S5 and are
 * refreshed by the user's own stream events, never chain polls (D-272).
 */
export const keys = {
  account: (chainId: ChainId, address: Address) => ["account", chainId, address.toLowerCase()] as const,
};
