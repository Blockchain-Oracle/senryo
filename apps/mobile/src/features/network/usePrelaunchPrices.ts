/**
 * Mainnet before launch (S8.22): no Senryo contracts on 143 in this build, so the markets read straight from the
 * Chainlink feeds they will settle on — real prices to browse while trading is closed. Never a fake tradable state.
 */
import { readFeedRound } from "@senryo/chain";
import { ENGINE_MARKETS, MAINNET_CHAIN_ID } from "@senryo/config";
import { useQueries } from "@tanstack/react-query";
import { sharedRead } from "~/lib/account/sender";
import { PRELAUNCH_PRICE_REFETCH_MS } from "./constants";

export interface PrelaunchPrice {
  symbol: string;
  name: string;
  answer: bigint;
  decimals: number;
  updatedAt: bigint;
}

export function usePrelaunchPrices(): Array<{ symbol: string; name: string; price: PrelaunchPrice | undefined }> {
  const queries = useQueries({
    queries: ENGINE_MARKETS.map((m) => ({
      queryKey: ["prelaunch", MAINNET_CHAIN_ID, m.symbol] as const,
      queryFn: async (): Promise<PrelaunchPrice> => {
        const round = await readFeedRound(sharedRead(MAINNET_CHAIN_ID), m.mainnetFeed);
        return {
          symbol: m.symbol,
          name: m.name,
          answer: round.answer,
          decimals: m.feedDecimals,
          updatedAt: round.updatedAt,
        };
      },
      refetchInterval: PRELAUNCH_PRICE_REFETCH_MS,
    })),
  });
  return ENGINE_MARKETS.map((m, i) => ({ symbol: m.symbol, name: m.name, price: queries[i]?.data }));
}
