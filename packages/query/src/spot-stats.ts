/**
 * The token list's market line (J11, F10: price change and size beside each token): each listed token's own pool on
 * GeckoTerminal, all in one keyless call per refresh (`/pools/multi`, ≤ 30 pools — the list has fewer), attributed.
 * GeckoTerminal's change and volume describe the pool's *base* token, so a token that sits on the quote side of its
 * pool gets no change rather than its partner's. Nothing is invented when the call fails: the rows show price only.
 */
import { GECKOTERMINAL_API, GECKOTERMINAL_NETWORK, SPOT_TOKENS, type SpotToken } from "@senryo/config";
import type { Reading } from "@senryo/core";
import { useQuery } from "@tanstack/react-query";
import { SPOT_STATS_REFETCH_MS } from "./constants.ts";
import { keys } from "./keys.ts";
import { readingOf } from "./reading.ts";

export interface TokenStats {
  /** 24 h price change (bps, signed), when the token is its pool's base. */
  change24hBps: bigint | undefined;
  /** 24 h volume of the token's pool (whole USD). */
  volume24hUsd: number | undefined;
  /** Fully diluted value (whole USD), as GeckoTerminal states it. */
  fdvUsd: number | undefined;
}

const BPS_PER_PERCENT = 100;

interface PoolRow {
  attributes?: {
    address?: string;
    price_change_percentage?: { h24?: string };
    volume_usd?: { h24?: string };
    fdv_usd?: string | null;
  };
  relationships?: { base_token?: { data?: { id?: string } } };
}

const finite = (text: string | null | undefined): number | undefined => {
  const n = text === null || text === undefined ? Number.NaN : Number(text);
  return Number.isFinite(n) ? n : undefined;
};

/** Stats per token symbol for `tokens`, from one call. */
export async function fetchTokenStats(
  tokens: readonly SpotToken[],
  signal?: AbortSignal,
): Promise<Map<string, TokenStats>> {
  const ids = tokens.map((t) => t.pool.poolId).join(",");
  const res = await fetch(`${GECKOTERMINAL_API}/networks/${GECKOTERMINAL_NETWORK}/pools/multi/${ids}`, {
    headers: { accept: "application/json" },
    ...(signal ? { signal } : {}),
  });
  if (!res.ok) throw new Error(`GeckoTerminal pools: HTTP ${res.status}`);
  const body = (await res.json()) as { data?: PoolRow[] };
  const byPool = new Map((body.data ?? []).map((p) => [p.attributes?.address?.toLowerCase() ?? "", p]));
  const out = new Map<string, TokenStats>();
  for (const token of tokens) {
    const row = byPool.get(token.pool.poolId.toLowerCase());
    if (!row) continue;
    const base = row.relationships?.base_token?.data?.id?.toLowerCase();
    const isBase = base === `${GECKOTERMINAL_NETWORK}_${token.address.toLowerCase()}`;
    const change = isBase ? finite(row.attributes?.price_change_percentage?.h24) : undefined;
    out.set(token.symbol, {
      change24hBps: change === undefined ? undefined : BigInt(Math.round(change * BPS_PER_PERCENT)),
      volume24hUsd: isBase ? finite(row.attributes?.volume_usd?.h24) : undefined,
      fdvUsd: isBase ? finite(row.attributes?.fdv_usd) : undefined,
    });
  }
  return out;
}

export function useTokenStats(tokens: readonly SpotToken[] = SPOT_TOKENS): Reading<Map<string, TokenStats>> {
  const query = useQuery({
    queryKey: keys.spotStats(tokens.map((t) => t.symbol).join(",")),
    queryFn: ({ signal }) => fetchTokenStats(tokens, signal),
    enabled: tokens.length > 0,
    refetchInterval: SPOT_STATS_REFETCH_MS,
    staleTime: SPOT_STATS_REFETCH_MS,
  });
  return readingOf(query, SPOT_STATS_REFETCH_MS);
}
