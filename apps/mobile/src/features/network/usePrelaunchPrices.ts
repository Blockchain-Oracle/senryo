/**
 * Mainnet before launch (S8.22): no Senryo contracts on 143 in this build, so the markets read straight from the
 * Chainlink feeds they will settle on — real prices to browse while trading is closed. Never a fake tradable state.
 */
import { readFeedRound } from "@senryo/chain";
import { type EngineMarket, engineMarketsOn, MAINNET_CHAIN_ID } from "@senryo/config";
import { queryOptions, useQueries, useQuery } from "@tanstack/react-query";
import { sharedRead } from "~/lib/account/sender";
import { PRELAUNCH_PRICE_REFETCH_MS } from "./constants";

export interface PrelaunchPrice {
  symbol: string;
  name: string;
  answer: bigint;
  decimals: number;
  /** Display precision per instrument (JPY/USD needs more than two decimals). */
  shown: number;
  updatedAt: bigint;
}

const MS_PER_SECOND = 1000;
const MAINNET_MARKETS = engineMarketsOn(MAINNET_CHAIN_ID);

function options(m: EngineMarket) {
  return queryOptions({
    queryKey: ["prelaunch", MAINNET_CHAIN_ID, m.symbol] as const,
    queryFn: async (): Promise<PrelaunchPrice> => {
      const round = await readFeedRound(sharedRead(MAINNET_CHAIN_ID), m.mainnetFeed);
      if (
        round.answer <= 0n ||
        round.updatedAt <= 0n ||
        round.updatedAt > BigInt(Math.floor(Date.now() / MS_PER_SECOND))
      ) {
        throw new Error("The price feed returned an invalid round");
      }
      return {
        symbol: m.symbol,
        name: m.name,
        answer: round.answer,
        decimals: m.feedDecimals,
        shown: m.priceDecimals,
        updatedAt: round.updatedAt,
      };
    },
    refetchInterval: PRELAUNCH_PRICE_REFETCH_MS,
    staleTime: PRELAUNCH_PRICE_REFETCH_MS,
  });
}

/** Rows observe only their own feed, rather than mounting seven observers for every row. */
export function usePrelaunchPrice(marketId: number) {
  const market = MAINNET_MARKETS.find((m) => m.id === marketId);
  if (!market) throw new Error(`Unknown feed: ${marketId}`);
  return useQuery(options(market));
}

export function usePrelaunchPrices() {
  const queries = useQueries({
    queries: MAINNET_MARKETS.map(options),
  });
  return MAINNET_MARKETS.map((m, i) => ({
    symbol: m.symbol,
    name: m.name,
    price: queries[i]?.data,
    failed: queries[i]?.isError ?? false,
  }));
}

export function feedUpdatedAt(price: PrelaunchPrice): string {
  const updatedSec = price.updatedAt;
  return `Updated ${new Date(Number(updatedSec) * MS_PER_SECOND).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
