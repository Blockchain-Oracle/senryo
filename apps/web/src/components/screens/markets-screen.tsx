"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MarketHeatmap } from "@/components/ui/market-heatmap";
import { MarketWatchlist } from "@/components/ui/market-watchlist";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ROUTES } from "@/lib/constants/routes";
import { MARKET_FILTERS, type MarketFilter, toHeat, toWatchlist } from "@/lib/market-view";
import { DEFAULT_MARKET, MARKETS } from "@/lib/sample";

const HEAT = MARKETS.map(toHeat);

/** Markets (D2): asset-class filter, dense perps watchlist, open-interest heatmap. */
export function MarketsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<MarketFilter>("all");
  const list = MARKETS.filter((m) => filter === "all" || m.kind === filter).map(toWatchlist);
  return (
    <div className="grid gap-x-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section aria-label="Watchlist">
        <div className="px-3 pt-3">
          <SegmentedControl
            label="Asset class"
            value={filter}
            onValueChange={(v) => setFilter(v as MarketFilter)}
            options={MARKET_FILTERS}
          />
        </div>
        <div className="px-3 pt-3">
          <MarketWatchlist
            title="Perps · 24h"
            initial={DEFAULT_MARKET}
            assets={list}
            onSelect={(symbol) => router.push(ROUTES.trade(symbol))}
          />
        </div>
      </section>
      <section aria-label="Heatmap" className="px-3 pt-3 lg:pt-15">
        <MarketHeatmap title="Heat · by open interest" subtitle="sized by open interest" data={HEAT} />
      </section>
    </div>
  );
}
