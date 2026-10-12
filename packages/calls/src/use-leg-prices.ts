/**
 * Each leg's live chance, both apps (S8.5, D-326): for a market and a lane, the window trading now, its open print K
 * (the stream's, or the archive's when the stream missed the open), and the Up and Down chances from the latest price
 * and the σ mark (`probE6`), recomputed once a second. The slip prices its picks with it (`useParlayQuote`); Parlay's
 * cards show each side's indicative odds from it (`indicativeOdds`).
 */
import { printRoute } from "@senryo/api-client";
import { type CadenceSec, FILL_DELAY_SEC, MARKETS } from "@senryo/config";
import { probE6 } from "@senryo/core";
import { useLive, useServerSeconds } from "@senryo/live/react";
import { useCatalog, useQueryEnv } from "@senryo/query";
import { useQueries } from "@tanstack/react-query";
import { PARLAY_SIDES } from "./parlay.ts";
import { fillMark } from "./sigma.ts";
import { type CallWindow, windowFor } from "./window.ts";

const PRINT_RETRIES = 10;
const PRINT_RETRY_MS = 1_000;

export interface LegInput {
  symbol: string;
  cadenceSec: CadenceSec;
}

export interface LegPrice {
  window: CallWindow;
  /** The window's open print (e-8), once known. */
  k: bigint | undefined;
  /** Each side's chance (e-6), in `PARLAY_SIDES` order (Up, Down); null until priced. */
  sides: readonly (bigint | null)[];
  /** The market's calendar group (legs in one group count as moving together). */
  group: number;
}

export function useLegPrices(inputs: readonly LegInput[]): { now: number; legs: LegPrice[] } {
  const now = useServerSeconds();
  const live = useLive();
  const { api } = useQueryEnv();
  const catalog = useCatalog();
  const windows = inputs.map((p) => windowFor(p.symbol, p.cadenceSec, now));
  const archived = useQueries({
    queries: windows.map((w) => ({
      queryKey: ["prices", "print", w.symbol, w.start],
      queryFn: async () => BigInt((await api.call(printRoute, { query: { symbol: w.symbol, t: w.start } })).priceE8),
      enabled: now > w.start && !live.prints.at(w.symbol, w.start),
      staleTime: Number.POSITIVE_INFINITY,
      retry: PRINT_RETRIES,
      retryDelay: PRINT_RETRY_MS,
    })),
  });
  const markets = "value" in catalog ? catalog.value.markets : [];
  const legs = inputs.map((p, i): LegPrice => {
    const w = windows[i] ?? windowFor(p.symbol, p.cadenceSec, now);
    const k = live.prints.at(w.symbol, w.start)?.priceE8 ?? archived[i]?.data;
    const series = markets.find((m) => m.symbol === p.symbol)?.series.find((s) => s.cadenceSec === p.cadenceSec);
    const spot = live.prices.latest(p.symbol)?.priceE8;
    const tau = BigInt(Math.max(0, w.expiry - (now + FILL_DELAY_SEC)));
    const mark = series ? fillMark(live.sigma, p.symbol, series, now) : undefined;
    const sides = PARLAY_SIDES.map((side) => {
      const band = series?.bands[side.band];
      return k !== undefined && spot !== undefined && band && mark
        ? probE6(band, k, BigInt(Math.round(spot)), mark.fastE8, mark.slowE8, tau)
        : null;
    });
    const group = MARKETS.find((m) => m.symbol === p.symbol)?.calendarId ?? 0;
    return { window: w, k, sides, group };
  });
  return { now, legs };
}
