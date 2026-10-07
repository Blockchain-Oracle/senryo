/**
 * Perpl's markets as the app names them (D1, flow book C4): the deployment market id (`perpId`), the ticker, what the
 * asset is called and the price / lot decimals fixed at listing — all configuration, so a page can draw its identity
 * before any read. Network-specific ids overlap our engine's, so every Perpl key is prefixed.
 */
import {
  type ChainId,
  MAINNET_CHAIN_ID,
  PERPL_ASSET_NAMES,
  PERPL_MARKET_SCALES,
  PERPL_MARKETS,
  PERPL_MIN_DEPOSIT_CNS,
} from "@senryo/config";
import { ids } from "@senryo/identity";
import { activeNetwork } from "~/lib/network";

/** The smallest top-up Perpl takes after the account exists (and a withdrawal's floor is 0.01). */
export const PERPL_TOP_UP_FLOOR = PERPL_MIN_DEPOSIT_CNS;

/** Perpl's own mark (the venue), for rows that are about the venue rather than one market. */
export const PERPL_VENUE_MARK = ids.venue("perpl");

export interface PerplMarketMeta {
  chainId: ChainId;
  marketId: number;
  symbol: string;
  name: string;
  priceDecimals: number;
  lotDecimals: number;
  /** The market's identity (its real mark) and Perpl's venue mark. */
  mark: string;
  venueMark: string;
}

const listedOn = (chainId: ChainId): readonly PerplMarketMeta[] =>
  Object.entries(PERPL_MARKETS[chainId] ?? {}).flatMap(([symbol, marketId]) => {
    const scale = PERPL_MARKET_SCALES[chainId]?.[marketId];
    if (!scale) return [];
    return [
      {
        chainId,
        marketId,
        symbol,
        name: PERPL_ASSET_NAMES[symbol] ?? symbol,
        ...scale,
        mark: ids.perplMarket(MAINNET_CHAIN_ID, PERPL_MARKETS[MAINNET_CHAIN_ID]?.[symbol] ?? marketId),
        venueMark: PERPL_VENUE_MARK,
      },
    ];
  });

export const PERPL_LISTED = listedOn(MAINNET_CHAIN_ID);

/** `BTC` / `btc` → its Perpl market on the selected deployment. */
export function perplMarketBySymbol(
  symbol: string,
  chainId: ChainId = activeNetwork().chainId,
): PerplMarketMeta | undefined {
  const upper = symbol.toUpperCase();
  return listedOn(chainId).find((m) => m.symbol === upper);
}

export function perplMarketById(
  marketId: number,
  chainId: ChainId = activeNetwork().chainId,
): PerplMarketMeta | undefined {
  return listedOn(chainId).find((m) => m.marketId === marketId);
}

/** The watchlist / discovery id of a Perpl market ("perpl:BTC"). */
export const perplWatchKey = (symbol: string) => `perpl:${symbol}` as const;

/** The position page id of a Perpl market (`perpl-1`, the indexer's market id). */
export const PERPL_POSITION_PREFIX = "perpl-";

export function perplMarketOfPositionId(id: string): PerplMarketMeta | undefined {
  if (!id.startsWith(PERPL_POSITION_PREFIX)) return undefined;
  const marketId = Number(id.slice(PERPL_POSITION_PREFIX.length));
  return Number.isInteger(marketId) ? perplMarketById(marketId) : undefined;
}
