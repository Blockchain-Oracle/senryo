/**
 * F26 collateral swap inside the account (mainnet only — the AUSD/USDC Uniswap v4 pool lives on 143): the Quoter's
 * exact-in quote on the deepest pool, a minimum-out `SWAP_SLIPPAGE_BPS` below it, and `SenryoCore.swapCollateral`
 * (the core re-checks `minOut` against what it actually received; D-122/D-180 six-field router params).
 */
import { contractCall, findStablePool, quoteExactIn, type TxRequest } from "@senryo/chain";
import { type ChainId, MAINNET_CHAIN_ID, MAINNET_EXTERNAL, positionGasLimit } from "@senryo/config";
import { type Address, fromQuery, type Reading, RISK } from "@senryo/core";
import { useQuery } from "@tanstack/react-query";
import { useQueryEnv } from "./env.tsx";

/** 10 bps below the quote: a 1:1 stable pool at 0.005 % fee; a larger move means the quote is stale — re-quote. */
export const SWAP_SLIPPAGE_BPS = 10n;
/** Quotes go stale fast; the swap sheet re-quotes this often while open. */
export const SWAP_QUOTE_REFRESH_MS = 10_000;

export interface CollateralQuote {
  tokenIn: Address;
  amountIn: bigint;
  amountOut: bigint;
  minOut: bigint;
}

export function useCollateralQuote(tokenIn: Address | undefined, amountIn: bigint): Reading<CollateralQuote> {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: ["collateral", env.chainId, "quote", tokenIn ?? "0x", amountIn.toString()] as const,
    queryFn: async (): Promise<CollateralQuote> => {
      const pool = await findStablePool(env.read);
      if (!pool || !tokenIn) throw new Error("no AUSD/USDC pool on this network");
      const zeroForOne = pool.key.currency0.toLowerCase() === tokenIn.toLowerCase();
      const { amountOut } = await quoteExactIn(env.read, pool.key, zeroForOne, amountIn);
      return { tokenIn, amountIn, amountOut, minOut: (amountOut * (RISK.BPS - SWAP_SLIPPAGE_BPS)) / RISK.BPS };
    },
    enabled: env.chainId === MAINNET_CHAIN_ID && tokenIn !== undefined && amountIn > 0n,
    refetchInterval: SWAP_QUOTE_REFRESH_MS,
    staleTime: SWAP_QUOTE_REFRESH_MS,
  });
  return fromQuery(query);
}

/** The two collateral tokens on mainnet, for the direction toggle. */
export const COLLATERAL_TOKENS = { ausd: MAINNET_EXTERNAL.ausd, usdc: MAINNET_EXTERNAL.usdc } as const;

export function swapCollateralRequest(chainId: ChainId, quote: CollateralQuote, positions: number): TxRequest {
  return contractCall(
    chainId,
    "SenryoCore",
    "swapCollateral",
    [quote.tokenIn, quote.amountIn, quote.minOut],
    "swapCollateral",
    {
      gasCap: positionGasLimit("swapCollateral", positions),
      meta: { kind: "swapCollateral" },
    },
  );
}
