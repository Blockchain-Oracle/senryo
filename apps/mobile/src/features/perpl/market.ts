/**
 * Perpl's markets as the app names them (D1, flow book C4): the mainnet market id (`perpId`), the ticker, what the
 * asset is called and the price / lot decimals fixed at listing — all configuration, so a page can draw its identity
 * before any read. Perpl is traded on Monad mainnet only; ids overlap our engine's, so every Perpl key is prefixed.
 */
import {
  MAINNET_CHAIN_ID,
  PERPL_ASSET_NAMES,
  PERPL_MARKET_SCALES,
  PERPL_MARKETS,
  PERPL_MIN_DEPOSIT_CNS,
} from "@senryo/config";
import { ids } from "@senryo/identity";

export const PERPL_CHAIN = MAINNET_CHAIN_ID;
/** Perpl moves real AUSD: amounts are always written in dollars, never Practice's P$. */
export const PERPL_MONEY = "mainnet" as const;
/** The smallest top-up Perpl takes after the account exists (and a withdrawal's floor is 0.01). */
export const PERPL_TOP_UP_FLOOR = PERPL_MIN_DEPOSIT_CNS;

export interface PerplMarketMeta {
  marketId: number;
  symbol: string;
  name: string;
  priceDecimals: number;
  lotDecimals: number;
  /** The market's identity (its real mark) and Perpl's venue mark. */
  mark: string;
  venueMark: string;
}

const LISTED: readonly PerplMarketMeta[] = Object.entries(PERPL_MARKETS[PERPL_CHAIN] ?? {}).flatMap(
  ([symbol, marketId]) => {
    const scale = PERPL_MARKET_SCALES[PERPL_CHAIN]?.[marketId];
    if (!scale) return [];
    return [
      {
        marketId,
        symbol,
        name: PERPL_ASSET_NAMES[symbol] ?? symbol,
        ...scale,
        mark: ids.perplMarket(PERPL_CHAIN, marketId),
        venueMark: ids.venue("perpl"),
      },
    ];
  },
);

export const PERPL_LISTED = LISTED;

/** `BTC` / `btc` → its Perpl market on mainnet. */
export function perplMarketBySymbol(symbol: string): PerplMarketMeta | undefined {
  const upper = symbol.toUpperCase();
  return LISTED.find((m) => m.symbol === upper);
}

export function perplMarketById(marketId: number): PerplMarketMeta | undefined {
  return LISTED.find((m) => m.marketId === marketId);
}

/** The watchlist / discovery id of a Perpl market ("perpl:BTC"). */
export const perplWatchKey = (symbol: string) => `perpl:${symbol}` as const;

/** The position page id of a Perpl market (`perpl-1`, the indexer's market id). */
export const PERPL_POSITION_PREFIX = "perpl-";
export const perplPositionId = (marketId: number) => `${PERPL_POSITION_PREFIX}${marketId}`;

export function perplMarketOfPositionId(id: string): PerplMarketMeta | undefined {
  if (!id.startsWith(PERPL_POSITION_PREFIX)) return undefined;
  const marketId = Number(id.slice(PERPL_POSITION_PREFIX.length));
  return Number.isInteger(marketId) ? perplMarketById(marketId) : undefined;
}
