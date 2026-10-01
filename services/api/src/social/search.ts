import {
  handleSyntaxIssue,
  normalizeHandle,
  SEARCH_RESULTS_MAX,
  type SearchKind,
  type SearchMarket,
  type SearchResult,
  type SearchTrader,
} from "@senryo/api-client";
import { type ChainId, engineMarketsOn, marketPair } from "@senryo/config";
import type { Db } from "@senryo/service-common";
import { viewerAccountFilter } from "./posts.ts";
import { identityOf, visibleOn } from "./shared.ts";

/**
 * Global search (S12b.7). Markets come from `@senryo/config` (our engine's listings on that network); traders from
 * profiles visible on that network (handle prefix, or an exact address); tokens wait for a token list.
 */

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
/** The indexer's id for our engine's market `n` (indexer/src/lib/markets.ts `ourMarketId`). */
const OURS_MARKET_PREFIX = "ours-";
/** LIKE wildcards inside a handle (`_` is a legal handle character) are escaped. */
const LIKE_SPECIAL = /[\\%_]/g;

export function searchMarkets(chainId: ChainId, q: string): SearchMarket[] {
  const needle = q.trim().toLowerCase();
  return engineMarketsOn(chainId)
    .filter((m) => {
      const id = `${OURS_MARKET_PREFIX}${m.id}`;
      return (
        m.symbol.toLowerCase().startsWith(needle) ||
        marketPair(m).toLowerCase().startsWith(needle) ||
        m.name.toLowerCase().includes(needle) ||
        id === needle
      );
    })
    .slice(0, SEARCH_RESULTS_MAX)
    .map((m) => ({
      id: `${OURS_MARKET_PREFIX}${m.id}`,
      engineId: m.id,
      symbol: m.symbol,
      pair: marketPair(m),
      name: m.name,
      category: m.category,
      venue: "SENRYO" as const,
    }));
}

export async function searchTraders(
  db: Db,
  chainId: ChainId,
  q: string,
  viewer: string | null,
): Promise<SearchTrader[]> {
  const raw = q.trim();
  let match: ReturnType<typeof db>;
  if (ADDRESS_RE.test(raw)) {
    match = db`p.address = ${raw.toLowerCase()}`;
  } else {
    const handle = normalizeHandle(raw);
    if (handle === "" || handleSyntaxIssue(handle) === "charset") return [];
    match = db`lower(p.handle) LIKE ${`${handle.replace(LIKE_SPECIAL, (c) => `\\${c}`)}%`}`;
  }
  const rows = await db<
    { address: string; handle: string | null; display_name: string | null; avatar: string | null }[]
  >`
    SELECT p.address, p.handle, p.display_name, p.avatar FROM profiles p
     WHERE ${match} AND ${visibleOn(db, "p", chainId)} ${viewerAccountFilter(db, viewer, "p", "address", "show")}
     ORDER BY length(p.handle) NULLS LAST, p.handle
     LIMIT ${SEARCH_RESULTS_MAX}`;
  return rows.map(identityOf);
}

export async function search(
  db: Db,
  chainId: ChainId,
  q: string,
  kind: SearchKind | undefined,
  viewer: string | null,
): Promise<SearchResult> {
  const wants = (k: SearchKind) => kind === undefined || kind === k;
  return {
    q,
    markets: wants("markets") ? searchMarkets(chainId, q) : [],
    // TODO(S12b.7): tokens need a token list (none in @senryo/config yet); until then this section is always empty.
    tokens: [],
    traders: wants("traders") ? await searchTraders(db, chainId, q, viewer) : [],
  };
}
