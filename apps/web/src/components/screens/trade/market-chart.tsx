"use client";

import { MAINNET_CHAIN_ID } from "@senryo/config";
import { DECIMALS, ONE_E18, toPlot } from "@senryo/core";
import { keys, useCandles } from "@senryo/query";
import { useMemo, useState } from "react";
import { CandleChart } from "@/components/ui/candle";
import type { Candle } from "@/components/ui/candle/scale";
import { known, ReadingView, useRetry } from "@/components/ui/reading";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { LOCALE } from "@/lib/constants/money";
import { price18, priceDecimalsOf } from "@/lib/format";
import type { MarketLine } from "@/lib/markets/line";
import {
  axisTimeLabel,
  CHART_PERIODS,
  DEFAULT_PERIOD,
  dayLabel,
  type PeriodKey,
  periodOf,
} from "@/lib/markets/periods";

const MS_PER_SECOND = 1000;
/** Fewer candles than this is not a chart. */
const MIN_CANDLES = 2;
/** The phone opens on the newest 96 candles and pans through the rest (FT096); the desk's "1Y" preset is 96. */
const INITIAL_VISIBLE = "1Y";
const PERIOD_OPTIONS = CHART_PERIODS.map((p) => ({ value: p.value, label: p.label }));

/** Above this price (1e18) a metal's axis reads to the dollar; silver's ~$60 keeps its cents so ticks don't repeat. */
const WHOLE_DOLLAR_AXIS_DOLLARS = 1_000n;
const WHOLE_DOLLAR_AXIS_FROM = WHOLE_DOLLAR_AXIS_DOLLARS * ONE_E18;

/** Axis precision per market: gold to the dollar, silver in cents, FX one place short of its quote. */
function axisDecimals(marketId: number, price18: bigint): number {
  const shown = priceDecimalsOf(marketId);
  if (shown > DECIMALS.cents) return shown - 1;
  return price18 >= WHOLE_DOLLAR_AXIS_FROM ? 0 : shown;
}

const fixed = (digits: number) => (v: number) =>
  `$${v.toLocaleString(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

/**
 * The trade page's chart (Fomo F32, the phone's `MarketChart`): candles of indexed Chainlink rounds on Monad mainnet —
 * the practice mirror relays that same feed — with the live oracle price as a dotted line tagged on the price axis, and
 * period chips under it. Each period is a candle size the indexer keeps; the caption says which, and from when the
 * drawn data starts. The block keeps its height while the next period loads.
 */
export function MarketChart({ line }: { line: MarketLine }) {
  const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PERIOD);
  const chosen = periodOf(period);
  const candles = useCandles(line.symbol, chosen.interval);
  const retry = useRetry(keys.candles(MAINNET_CHAIN_ID, line.symbol, chosen.interval));
  const rows = known(candles);
  // Mapped once per candle read, not per price tick: the chart only re-plots when the candles change.
  const plotted = useMemo<Candle[]>(
    () =>
      (rows ?? []).map((c) => ({
        o: toPlot(c.open, DECIMALS.e18),
        h: toPlot(c.high, DECIMALS.e18),
        l: toPlot(c.low, DECIMALS.e18),
        c: toPlot(c.close, DECIMALS.e18),
        v: 0,
        t: c.openTime * MS_PER_SECOND,
      })),
    [rows],
  );
  const axis = axisDecimals(line.marketId, line.price18);
  const first = rows?.[0];
  return (
    <div className="grid gap-2">
      <div className="flex min-h-72 flex-col justify-center border-border border-y lg:min-h-112 lg:border">
        <ReadingView
          reading={candles}
          loadingLabel="Loading Chainlink rounds"
          retry={retry}
          className="p-4"
          skeleton={<Skeleton className="h-56 w-full lg:h-96" />}
        >
          {() =>
            plotted.length < MIN_CANDLES ? (
              <p className="p-6 text-center text-caption text-muted-foreground">No rounds in this window yet</p>
            ) : (
              <CandleChart
                key={`${line.symbol}-${period}`}
                candles={plotted}
                symbol={line.symbol}
                chrome={false}
                fill
                volume={false}
                initialTimeframe={INITIAL_VISIBLE}
                plotClassName="h-72 lg:h-112"
                priceFmt={fixed(priceDecimalsOf(line.marketId))}
                axisFmt={fixed(axis)}
                dateFmt={(t) => axisTimeLabel(chosen.axis, t)}
                current={{ value: toPlot(line.price18, DECIMALS.e18), label: `$${price18(line.price18, axis)}` }}
              />
            )
          }
        </ReadingView>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 lg:px-0">
        <p className="font-mono text-micro text-muted-foreground">
          Chainlink {line.symbol}/USD · Monad · {chosen.candle} candles
          {first ? ` since ${dayLabel(first.openTime * MS_PER_SECOND)}` : ""}
        </p>
        <SegmentedControl
          label="Chart period"
          value={period}
          onValueChange={(v) => setPeriod(v as PeriodKey)}
          options={PERIOD_OPTIONS}
        />
      </div>
    </div>
  );
}
