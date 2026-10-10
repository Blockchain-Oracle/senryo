/**
 * The σ a quote prices with (R4.3, D-313): the live mark the fill would carry — its market's mark for the last minute
 * boundary at least 5 s before the fill print (`markMinuteOf`) — else, before the first mark streams in, the listed σ;
 * either held to the series' bounds as the reserve holds it. One rule for the terminal, Duel, Parlay and Lucky.
 */
import { FILL_DELAY_SEC } from "@senryo/config";
import { clampMark, markMinuteOf, type SigmaPair } from "@senryo/core";
import type { SigmaBook } from "@senryo/live";

/** What the catalogue lists for a series' σ (`/v1/markets/catalog`). */
export interface SeriesSigma {
  sigmaE8: number;
  sigmaFloorE8: number;
  sigmaCapE8: number;
}

export function fillMark(book: SigmaBook, symbol: string, series: SeriesSigma, nowSec: number): SigmaPair {
  const live = book.at(symbol, markMinuteOf(nowSec + FILL_DELAY_SEC));
  const listed = BigInt(series.sigmaE8);
  return clampMark(live ?? { fastE8: listed, slowE8: listed }, BigInt(series.sigmaFloorE8), BigInt(series.sigmaCapE8));
}
