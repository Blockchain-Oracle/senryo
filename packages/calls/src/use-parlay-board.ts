/**
 * Parlay's board (P3, D-326), both apps: the markets that take calls now in their kind groups (search and filter
 * applied), and the ones that don't — closed for the session, paused, not on chain yet — as one list the screen keeps
 * collapsed. Worked out once a minute on the server's clock (sessions change on 15-minute boundaries).
 */
import { useServerSeconds } from "@senryo/live/react";
import { useMemo } from "react";
import { groupMarkets, type MarketFilter, marketLine, marketSession } from "./markets.ts";

const SECONDS_PER_MINUTE = 60;

interface BoardMarket {
  symbol: string;
  name: string;
  kind: string;
  paused?: string | null | undefined;
  listed?: boolean | undefined;
}

export function useParlayBoard<T extends BoardMarket>(
  markets: readonly T[],
  query: string,
  filter: MarketFilter,
): { groups: { label: string; markets: T[] }[]; closed: T[] } {
  const now = useServerSeconds();
  const minute = Math.floor(now / SECONDS_PER_MINUTE);
  return useMemo(() => {
    const at = minute * SECONDS_PER_MINUTE;
    const takes = (m: T) => marketLine(marketSession(m.symbol, at), at, m.paused ?? null, m.listed ?? true).trading;
    const groups = groupMarkets(markets.filter(takes), query, filter);
    const closed = groupMarkets(
      markets.filter((m) => !takes(m)),
      query,
      filter,
    ).flatMap((g) => g.markets);
    return { groups, closed };
  }, [markets, query, filter, minute]);
}
