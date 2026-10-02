/**
 * Alchemy Portfolio API — the fallback discovery when HyperSync can't answer (plan §0.8 B1): one call lists the
 * address's native and ERC-20 tokens on `monad-mainnet` / `monad-testnet`, with USD prices. Balances are still read
 * onchain by the caller, so every source yields the same shape. Only runs with `ALCHEMY_API_KEY` set; the key travels
 * in the path, so errors never include the URL. Not exercised live yet (no key on 2 Oct): parsing is defensive.
 */
import { type Address, getAddress, isAddress } from "@senryo/chain";
import { ALCHEMY_DATA_API, ALCHEMY_NETWORK, type ChainId } from "@senryo/config";
import { z } from "zod";
import { ALCHEMY_PAGES_MAX } from "./constants.ts";
import type { TokenPrice } from "./gecko.ts";
import { decimalToUnits, fetchJson } from "./upstream.ts";

const PRICE_DECIMALS = 18;

const responseSchema = z.object({
  data: z.object({
    tokens: z.array(
      z.object({
        tokenAddress: z.string().nullish(),
        tokenPrices: z.array(z.object({ currency: z.string(), value: z.string() })).nullish(),
      }),
    ),
    pageKey: z.string().nullish(),
  }),
});

export interface AlchemyDiscovery {
  tokens: Address[];
  /** USD prices Alchemy returned, keyed by lower-case address (native MON is not keyed). */
  prices: Map<string, TokenPrice>;
}

export async function alchemyDiscover(apiKey: string, chainId: ChainId, owner: Address): Promise<AlchemyDiscovery> {
  const tokens = new Set<string>();
  const prices = new Map<string, TokenPrice>();
  let pageKey: string | undefined;
  for (let page = 0; page < ALCHEMY_PAGES_MAX; page += 1) {
    const res = await fetchJson("alchemy", `${ALCHEMY_DATA_API}/${apiKey}/assets/tokens/by-address`, {
      method: "POST",
      body: {
        addresses: [{ address: owner, networks: [ALCHEMY_NETWORK[chainId]] }],
        withMetadata: false,
        withPrices: true,
        includeNativeTokens: false,
        includeErc20Tokens: true,
        ...(pageKey ? { pageKey } : {}),
      },
    });
    const { data } = responseSchema.parse(res?.json);
    for (const token of data.tokens) {
      if (!token.tokenAddress || !isAddress(token.tokenAddress)) continue;
      const address = token.tokenAddress.toLowerCase();
      tokens.add(address);
      const usd = token.tokenPrices?.find((p) => p.currency.toLowerCase() === "usd");
      const price = decimalToUnits(usd?.value, PRICE_DECIMALS);
      if (price !== undefined && price > 0n)
        prices.set(address, { priceUsd18: price, change24hBps: null, source: "alchemy" });
    }
    pageKey = data.pageKey ?? undefined;
    if (!pageKey) break;
  }
  return { tokens: [...tokens].map((t) => getAddress(t)), prices };
}
