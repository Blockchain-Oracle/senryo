/**
 * Market Holders (FT098): the open positions in one engine market of people who share their trades on this network,
 * largest first, with entry and price-move P&L at the accepted price (`GET /v1/markets/:id/holders`). `friends`
 * narrows it to people the session follows, so it runs only once the caller has an api session; everyone is public.
 */
import { marketHoldersRoute } from "@senryo/api-client";
import { fromQuery } from "@senryo/core";
import { useQuery } from "@tanstack/react-query";
import { useQueryEnv } from "./env.tsx";
import { socialKeys } from "./social.ts";

/** Holders move with fills and the price; the api caches a few seconds, the screen re-reads at this pace. */
export const HOLDERS_REFETCH_MS = 20_000;

export function useMarketHolders(marketId: number, friends: boolean, enabled = true) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: socialKeys.holders(env.chainId, marketId, friends),
    queryFn: ({ signal }) =>
      env.api.call(marketHoldersRoute, { params: { marketId }, query: { chainId: env.chainId, friends } }, { signal }),
    enabled,
    staleTime: HOLDERS_REFETCH_MS,
    refetchInterval: HOLDERS_REFETCH_MS,
  });
  return { reading: fromQuery(query), retry: () => void query.refetch() };
}
