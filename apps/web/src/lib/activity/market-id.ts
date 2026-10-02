import { ids } from "@senryo/identity";

/**
 * Indexer market ids ("ours-0" = our engine's market 0, "perpl-16" = Perpl's perp 16; indexer/schema.graphql) as the
 * app uses them: the engine market number for our own markets, and the identity whose mark a row shows.
 */
const OURS_PREFIX = "ours-";
const PERPL_PREFIX = "perpl-";

/** "ours-3" → 3; undefined for another venue's market. */
export function engineMarketIndex(marketId: string): number | undefined {
  if (!marketId.startsWith(OURS_PREFIX)) return undefined;
  const index = Number(marketId.slice(OURS_PREFIX.length));
  return Number.isInteger(index) ? index : undefined;
}

/** The canonical identity of an indexed market on `chainId`, for its real mark. */
export function indexedMarketMark(chainId: number, marketId: string): string | undefined {
  const ours = engineMarketIndex(marketId);
  if (ours !== undefined) return ids.engineMarket(chainId, ours);
  if (!marketId.startsWith(PERPL_PREFIX)) return undefined;
  const perp = Number(marketId.slice(PERPL_PREFIX.length));
  return Number.isInteger(perp) ? ids.perplMarket(chainId, perp) : undefined;
}
