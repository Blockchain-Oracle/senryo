"use client";

import { DECIMALS, notional } from "@senryo/core";
import { useState } from "react";
import { DeskWatchlist } from "@/components/screens/markets/desk-watchlist";
import { marketTitles } from "@/components/screens/markets/market-row";
import LoadingState from "@/components/ui/loading-state";
import { type HeatTile, MarketHeatmap } from "@/components/ui/market-heatmap";
import { known } from "@/components/ui/reading";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { BPS_PERCENT_DECIMALS } from "@/lib/constants/money";
import { compactMoney, plotValue, price18, priceDecimalsOf } from "@/lib/format";
import { type MarketLines, useMarketLines } from "@/lib/markets/line";
import { inFilter, MARKET_FILTERS, type MarketFilter } from "@/lib/markets/universe";

/** Open interest per market (both sides at the oracle price, from the engine's book); only markets that have some. */
function heatTiles(lines: MarketLines, filter: MarketFilter): HeatTile[] {
  return lines.flatMap(({ meta, reading }) => {
    const line = known(reading);
    if (!line || !inFilter(meta, filter)) return [];
    const { book } = line.market;
    const oi6 = notional(book.longSize + book.shortSize, line.price18);
    if (oi6 === 0n) return [];
    return [
      {
        sym: marketTitles(meta).title,
        name: meta.name,
        cap: plotValue(oi6),
        chg: line.change24hBps === undefined ? 0 : plotValue(line.change24hBps, BPS_PERCENT_DECIMALS),
        price: plotValue(line.price18, DECIMALS.e18),
        priceText: `$${price18(line.price18, priceDecimalsOf(meta.id))}`,
        capText: `OI ${compactMoney(oi6)}`,
      },
    ];
  });
}

function OpenInterestMap({ lines, filter }: { lines: MarketLines; filter: MarketFilter }) {
  const tiles = heatTiles(lines, filter);
  const reading = lines.some((l) => known(l.reading) !== undefined);
  if (tiles.length > 0) {
    return (
      <MarketHeatmap title="Open interest" subtitle="tile size · open interest; colour · 24 h change" data={tiles} />
    );
  }
  return (
    <div className="grid min-h-48 content-center justify-items-center gap-2 rounded-lg border border-border border-dashed p-6 text-center">
      {reading ? (
        <>
          <p className="font-medium text-caption">No open interest {filter === "all" ? "" : "here "}yet</p>
          <p className="max-w-xs text-caption text-muted-foreground">
            The map sizes each {ACTIVE_NETWORK.modeLabel} market by the positions open in it, read from the engine's
            book. It fills as positions open.
          </p>
        </>
      ) : (
        <LoadingState label="Reading the engine's book" />
      )}
    </div>
  );
}

/** Markets (S11b): asset-class filter, the live perps watchlist with what's still to come, the open-interest map. */
export function MarketsScreen() {
  const [filter, setFilter] = useState<MarketFilter>("all");
  const lines = useMarketLines();
  return (
    <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
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
          <DeskWatchlist lines={lines} filter={filter} arriving />
        </div>
      </section>
      <section aria-label="Open interest" className="px-3 pt-3 lg:pt-15">
        <OpenInterestMap lines={lines} filter={filter} />
      </section>
    </div>
  );
}
