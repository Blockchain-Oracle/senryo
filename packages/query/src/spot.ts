/**
 * J11 spot tokens (S1b.16): prices, quotes and holdings of the Monad tokens bought and sold with USDC through Uniswap
 * v4 (`SPOT_TOKENS`, generated). The pools exist only on mainnet, so every read goes to 143 whichever network is
 * selected — like the metal charts, which read mainnet Chainlink rounds in both modes (D-163). A Practice screen shows
 * the real market read-only and says so; sends are mainnet-only (`prepareTokenSwap`).
 */
import {
  createReadClient,
  prepareTokenSwap,
  quoteSpot,
  type ReadClient,
  readSpotHoldings,
  readSpotPrices,
  SPOT_SLIPPAGE_BPS,
  type SpotHolding,
  type SpotPrice,
  type SpotQuote,
  type SpotSide,
  spotMinOut,
  type TxRequest,
} from "@senryo/chain";
import { MAINNET_CHAIN_ID, SPOT_TOKENS, type SpotToken } from "@senryo/config";
import type { Address, Reading } from "@senryo/core";
import { useQuery } from "@tanstack/react-query";
import { SPOT_HOLDINGS_REFETCH_MS, SPOT_PRICE_REFETCH_MS, SPOT_QUOTE_REFRESH_MS } from "./constants.ts";
import { type QueryEnv, useQueryEnv } from "./env.tsx";
import { keys } from "./keys.ts";
import { readingOf } from "./reading.ts";

let ownMainnetRead: ReadClient | undefined;

/** The 143 client: the active one on Mainnet, else the app's `mainnetRead`, else one made once here. */
export function mainnetReadOf(env: QueryEnv): ReadClient {
  if (env.chainId === MAINNET_CHAIN_ID) return env.read;
  if (env.mainnetRead) return env.mainnetRead;
  ownMainnetRead ??= createReadClient(MAINNET_CHAIN_ID);
  return ownMainnetRead;
}

const tokenKey = (tokens: readonly SpotToken[]) => tokens.map((t) => t.symbol).join(",");

/** Mid prices (USD × 1e18 per token) of `tokens`, each route read once per refresh at one block. */
export function useTokenPrices(tokens: readonly SpotToken[] = SPOT_TOKENS): Reading<SpotPrice[]> {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: keys.spotPrices(tokenKey(tokens)),
    queryFn: () => readSpotPrices(mainnetReadOf(env), tokens),
    enabled: tokens.length > 0,
    refetchInterval: SPOT_PRICE_REFETCH_MS,
    staleTime: SPOT_PRICE_REFETCH_MS,
  });
  return readingOf(query, SPOT_PRICE_REFETCH_MS);
}

export interface TokenQuote extends SpotQuote {
  /** `amountOut` less `slippageBps`: the minimum the swap is sent with. */
  minOut: bigint;
  slippageBps: bigint;
}

/**
 * Exact-in quote: `side` "buy" spends `amountIn` USDC (6 decimals) on the token, "sell" spends `amountIn` of the token
 * for USDC. Re-quoted while the ticket is open; the swap is sent with this quote's `minOut`.
 */
export function useTokenQuote(
  token: SpotToken | undefined,
  side: SpotSide,
  amountIn: bigint,
  slippageBps: bigint = SPOT_SLIPPAGE_BPS,
): Reading<TokenQuote> {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: keys.spotQuote(token?.symbol ?? "", side, amountIn.toString(), slippageBps.toString()),
    queryFn: async (): Promise<TokenQuote> => {
      if (!token) throw new Error("no token");
      const quote = await quoteSpot(mainnetReadOf(env), token, side, amountIn);
      return { ...quote, minOut: spotMinOut(quote.amountOut, slippageBps), slippageBps };
    },
    enabled: token !== undefined && amountIn > 0n,
    refetchInterval: SPOT_QUOTE_REFRESH_MS,
    staleTime: SPOT_QUOTE_REFRESH_MS,
  });
  return readingOf(query, SPOT_QUOTE_REFRESH_MS);
}

/**
 * Wallet balances of `tokens` held by `address` on mainnet (native MON included). Keyed under the 143 account, so a
 * finalized swap's `keys.account(143, address)` invalidation refreshes them.
 */
export function useTokenHoldings(
  address: Address | undefined,
  tokens: readonly SpotToken[] = SPOT_TOKENS,
): Reading<SpotHolding[]> {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: keys.spotHoldings(address ?? "0x", tokenKey(tokens)),
    queryFn: () => readSpotHoldings(mainnetReadOf(env), address as Address, tokens),
    enabled: address !== undefined && tokens.length > 0,
    refetchInterval: SPOT_HOLDINGS_REFETCH_MS,
    staleTime: SPOT_HOLDINGS_REFETCH_MS,
  });
  return readingOf(query, SPOT_HOLDINGS_REFETCH_MS);
}

/**
 * The ordered sends for a quoted swap from `owner`'s own account on mainnet: [approve?, permit2Approve?, execute], the
 * allowances read now, the minimum from the quote, the execute budget sized from the quote's own gas metering.
 * Send them in order with the mainnet sender; stop at the first that fails.
 */
export function tokenSwapRequests(env: QueryEnv, owner: Address, quote: TokenQuote): Promise<TxRequest[]> {
  return prepareTokenSwap(mainnetReadOf(env), owner, {
    token: quote.token,
    side: quote.side,
    amountIn: quote.amountIn,
    minOut: quote.minOut,
    recipient: owner,
    quoteGas: quote.gasEstimate,
  });
}

/** The listed token by symbol or address (case-insensitive), or undefined. */
export function spotToken(symbolOrAddress: string): SpotToken | undefined {
  const needle = symbolOrAddress.toLowerCase();
  return SPOT_TOKENS.find((t) => t.symbol.toLowerCase() === needle || t.address.toLowerCase() === needle);
}
