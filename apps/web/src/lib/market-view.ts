import type { HeatTile } from "@/components/ui/market-heatmap";
import type { WatchlistAsset } from "@/components/ui/market-watchlist";
import { BPS_PERCENT_DECIMALS } from "@/lib/constants/money";
import { plotValue } from "@/lib/format";
import type { MarketKind, SampleMarket, Session } from "@/lib/sample";
import { sampleSpark } from "@/lib/sample-series";

const SPARK_DRIFT_PER_PCT = 0.2;

export const SESSION_LABEL: Record<Session, string> = {
  OPEN: "Open",
  "24/7": "24/7",
  CLOSED: "Closed",
  SOON: "Coming soon",
};

export const changePct = (m: SampleMarket) => plotValue(m.changeBps, BPS_PERCENT_DECIMALS);

/** Watchlist row: venue + session + max leverage on the second line (session badges, plan S8). */
export function toWatchlist(m: SampleMarket): WatchlistAsset {
  const venue = m.venue === "PERPL" ? "Perpl · " : "";
  return {
    symbol: m.symbol,
    name: `${venue}${SESSION_LABEL[m.session]} · ${m.maxLev}× max`,
    price: plotValue(m.price6),
    change: changePct(m),
    points: sampleSpark(m.seed, changePct(m) * SPARK_DRIFT_PER_PCT),
  };
}

export function toHeat(m: SampleMarket): HeatTile {
  return { sym: m.symbol, name: m.name, cap: plotValue(m.oi6), chg: changePct(m), price: plotValue(m.price6) };
}

export type MarketFilter = "all" | MarketKind;

export const MARKET_FILTERS: readonly { value: MarketFilter; label: string }[] = [
  { value: "all", label: "ALL" },
  { value: "metal", label: "METALS" },
  { value: "crypto", label: "CRYPTO" },
  { value: "equity", label: "EQUITY" },
  { value: "fx", label: "FX" },
];
