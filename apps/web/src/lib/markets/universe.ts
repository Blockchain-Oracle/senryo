/**
 * The market universe as Markets lists it (the phone's `universe.ts`, direction §8): our engine's markets that trade
 * on this network, and the ones that don't yet — identity and why, never a price (plan §2.5). Crypto: every market
 * Perpl lists on mainnet (S7 brings them onto this ticket). FX: the engine's pairs until they are listed here.
 * Equities wait for a live price feed (D-220).
 */
import { type ChainId, ENGINE_MARKETS, type EngineMarket, engineMarketsOn, MAINNET_CHAIN_ID } from "@senryo/config";
import { entity, ids, PERPL_MARKETS, perplMarketId } from "@senryo/identity";

export const MARKET_FILTERS = [
  { value: "all", label: "ALL" },
  { value: "commodities", label: "METALS" },
  { value: "fx", label: "FX" },
  { value: "crypto", label: "CRYPTO" },
  { value: "equities", label: "EQUITY" },
] as const;
export type MarketFilter = (typeof MARKET_FILTERS)[number]["value"];
type ArrivingClass = Exclude<MarketFilter, "all" | "commodities">;

const FX_QUOTE = "USD";

/** A market that isn't tradeable here yet: who it is and the one short reason. */
export interface ArrivingMarket {
  /** What the row is called: a ticker ("BTC", "NVDA") or the pair as traded ("EUR/USD"). */
  symbol: string;
  name: string;
  venue: "Perpl" | "Senryo";
  /** One short reason, shown at the right of the row. */
  note: string;
  /** Canonical identity (`ids`) for its real mark. */
  mark: string;
  assetClass: ArrivingClass;
}

export function inFilter(market: Pick<EngineMarket, "category">, filter: MarketFilter): boolean {
  if (filter === "all") return true;
  return filter === "commodities" ? market.category === "metal" : filter === "fx" && market.category === "fx";
}

export function arrivingMarkets(chainId: ChainId, filter: MarketFilter): readonly ArrivingMarket[] {
  const listed = engineMarketsOn(chainId);
  const crypto: ArrivingMarket[] = Object.keys(PERPL_MARKETS[MAINNET_CHAIN_ID] ?? {}).map((symbol) => {
    const mark = perplMarketId(MAINNET_CHAIN_ID, symbol) ?? ids.equity(symbol);
    return {
      symbol,
      name: entity(mark)?.name ?? symbol,
      venue: "Perpl",
      note: "With Perpl trading",
      assetClass: "crypto",
      mark,
    };
  });
  const fx: ArrivingMarket[] = ENGINE_MARKETS.filter(
    (m) => m.category === "fx" && !listed.some((l) => l.id === m.id),
  ).map((m) => ({
    symbol: `${m.symbol}/${FX_QUOTE}`,
    name: m.name,
    venue: "Senryo",
    note: chainId === MAINNET_CHAIN_ID ? "At mainnet launch" : "After the timelock",
    assetClass: "fx",
    mark: ids.fxPair(m.symbol, FX_QUOTE),
  }));
  const equities: ArrivingMarket[] = [
    {
      symbol: "NVDA",
      name: "Nvidia",
      venue: "Senryo",
      note: "Needs a live feed",
      assetClass: "equities",
      mark: ids.equity("NVDA"),
    },
  ];
  return [...crypto, ...fx, ...equities].filter((m) => filter === "all" || m.assetClass === filter);
}
