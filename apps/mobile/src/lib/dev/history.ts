import { TESTNET_CHAIN_ID } from "@senryo/config";
import { CandlesDocument } from "@senryo/indexer-client";
import type { QueryEnv } from "@senryo/query";
import { DEV_ORIGIN, requireDevWorkspace } from "./config";

/** Only observations confirmed by the same local oracle that prices the development ticket. */
export const devMarketHistory: NonNullable<QueryEnv["marketHistory"]> = {
  chainId: TESTNET_CHAIN_ID,
  label: "Local fork · controlled oracle",
  load: async (symbol, interval, since, signal) => {
    requireDevWorkspace();
    const response = await fetch(`${DEV_ORIGIN}/candles`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol, interval, since }),
      signal,
    });
    if (!response.ok) throw new Error(await response.text());
    return CandlesDocument.parse(await response.json());
  },
};

export async function devPerplSnapshot(): Promise<unknown> {
  requireDevWorkspace();
  const response = await fetch(`${DEV_ORIGIN}/perpl-state`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  if (!response.ok) throw new Error("Local Perpl market state unavailable");
  return response.json();
}
