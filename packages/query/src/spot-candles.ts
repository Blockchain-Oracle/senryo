/**
 * J11 token chart (S1b.16): USD candles of a spot token's own pool from GeckoTerminal's keyless pool-OHLCV endpoint
 * (it indexes Uniswap v4 on Monad by PoolId). Verified 1 Oct 2026 for MON/USDC, WBTC/MON and shMON/MON: an interval
 * without a trade has no candle (thin pools are sparse — the chart draws the gaps), and daily history went back 183
 * days. A window with no trades at all comes back as `{ kind: "none" }`; nothing is interpolated or synthesised.
 * Network or rate-limit failures are a failed Reading (retry), never "no history". Attribution:
 * `GECKOTERMINAL_ATTRIBUTION` beside the chart.
 */
import { GECKOTERMINAL_API, GECKOTERMINAL_ATTRIBUTION, GECKOTERMINAL_NETWORK, type SpotToken } from "@senryo/config";
import { parseUnits, type Reading } from "@senryo/core";
import type { CandleInterval } from "@senryo/indexer-client";
import { useQuery } from "@tanstack/react-query";
import { CANDLE_WINDOW_SEC, SPOT_CANDLES_REFETCH_MS } from "./constants.ts";
import { keys } from "./keys.ts";
import { readingOf } from "./reading.ts";

/** One candle: open time (unix seconds) and USD × 1e18 prices of one whole token. */
export interface TokenCandle {
  t: number;
  o: bigint;
  h: bigint;
  l: bigint;
  c: bigint;
}

export type TokenCandles =
  | {
      kind: "history";
      candles: TokenCandle[];
      source: { text: string; url: string };
    }
  | { kind: "none"; reason: string };

/** GeckoTerminal timeframe + aggregate for each chart interval the app offers (the indexer's intervals). */
const GT_TIMEFRAME: Readonly<Record<CandleInterval, { timeframe: "minute" | "hour" | "day"; aggregate: number }>> = {
  300: { timeframe: "minute", aggregate: 5 },
  900: { timeframe: "minute", aggregate: 15 },
  3600: { timeframe: "hour", aggregate: 1 },
  14400: { timeframe: "hour", aggregate: 4 },
  86400: { timeframe: "day", aggregate: 1 },
};
/** The endpoint returns at most this many candles per call. */
const GT_MAX_CANDLES = 1_000;
const PRICE_DECIMALS = 18;
const HTTP_NOT_FOUND = 404;
const OHLC_FIELDS = 5;

const SCIENTIFIC = /^(\d+)(?:\.(\d+))?e([+-]\d+)$/;

/**
 * A JSON number as GeckoTerminal wrote it → plain decimal text. `String(n)` is the shortest text that reads back as
 * the same double (so "0.03237018" stays exact); below 1e-6 or from 1e21 it is scientific, which is expanded here.
 */
function decimalText(value: number): string {
  const text = String(value);
  const sci = SCIENTIFIC.exec(text);
  if (!sci) return text;
  const [, whole = "", fraction = "", exp = "0"] = sci;
  const digits = whole + fraction;
  const point = whole.length + Number(exp);
  if (point <= 0) return `0.${"0".repeat(-point)}${digits}`;
  if (point >= digits.length) return digits + "0".repeat(point - digits.length);
  return `${digits.slice(0, point)}.${digits.slice(point)}`;
}

/** A JSON number price → USD × 1e18; digits past 1e-18 are dropped (far below any chart's resolution). */
function price18(value: unknown): bigint | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  const [whole, fraction = ""] = decimalText(value).split(".");
  const parsed = parseUnits(`${whole}.${fraction.slice(0, PRICE_DECIMALS)}`, PRICE_DECIMALS);
  return parsed.ok ? parsed.value : undefined;
}

/** Oldest → newest USD candles of the token's pool over the chart window of `interval`. */
export async function fetchTokenCandles(
  token: SpotToken,
  interval: CandleInterval,
  signal?: AbortSignal,
): Promise<TokenCandles> {
  const { timeframe, aggregate } = GT_TIMEFRAME[interval];
  const limit = Math.min(Math.ceil(CANDLE_WINDOW_SEC[interval] / interval), GT_MAX_CANDLES);
  const url =
    `${GECKOTERMINAL_API}/networks/${GECKOTERMINAL_NETWORK}/pools/${token.pool.poolId}/ohlcv/${timeframe}` +
    `?aggregate=${aggregate}&limit=${limit}&currency=usd&token=${token.address}`;
  const res = await fetch(url, { headers: { accept: "application/json" }, ...(signal ? { signal } : {}) });
  if (res.status === HTTP_NOT_FOUND) return { kind: "none", reason: "GeckoTerminal does not index this pool" };
  if (!res.ok) throw new Error(`GeckoTerminal OHLCV: HTTP ${res.status}`);
  const body = (await res.json()) as { data?: { attributes?: { ohlcv_list?: unknown[][] } } };
  const candles = (body.data?.attributes?.ohlcv_list ?? [])
    .map((row): TokenCandle | undefined => {
      const [t, o, h, l, c] = row.slice(0, OHLC_FIELDS);
      const prices = [o, h, l, c].map(price18);
      const [po, ph, pl, pc] = prices;
      if (typeof t !== "number" || po === undefined || ph === undefined || pl === undefined || pc === undefined)
        return undefined;
      return { t, o: po, h: ph, l: pl, c: pc };
    })
    .filter((c): c is TokenCandle => c !== undefined)
    .sort((a, b) => a.t - b.t);
  if (candles.length === 0) return { kind: "none", reason: "No trades in this pool over the period" };
  return {
    kind: "history",
    candles,
    source: { text: GECKOTERMINAL_ATTRIBUTION.text, url: GECKOTERMINAL_ATTRIBUTION.poolUrl(token.pool.poolId) },
  };
}

/** The token chart's candles for `interval` (5 m … 1 d), refreshed once a minute. */
export function useTokenCandles(token: SpotToken | undefined, interval: CandleInterval): Reading<TokenCandles> {
  const query = useQuery({
    queryKey: keys.spotCandles(token?.symbol ?? "", interval),
    queryFn: ({ signal }) => {
      if (!token) throw new Error("no token");
      return fetchTokenCandles(token, interval, signal);
    },
    enabled: token !== undefined,
    refetchInterval: SPOT_CANDLES_REFETCH_MS,
    staleTime: SPOT_CANDLES_REFETCH_MS,
  });
  return readingOf(query, SPOT_CANDLES_REFETCH_MS);
}
