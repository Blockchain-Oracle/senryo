"use client";

import { type Address, DECIMALS, toPlot } from "@senryo/core";
import type { EquityCurve as Curve } from "@senryo/indexer-client";
import { keys, useEquityHistory, useQueryEnv } from "@senryo/query";
import { useMemo, useState } from "react";
import { BalanceChart, type EquityFrame, FramePills } from "@/components/ui/balance-chart";
import { ReadingView, useRetry } from "@/components/ui/reading";
import { Skeleton } from "@/components/ui/skeleton";
import { LOCALE } from "@/lib/constants/money";
import { MONEY } from "@/lib/format";

/** Chart windows (seconds) per timeframe pill, as on the phone; ALL = a year (the indexer keeps every snapshot). */
const WINDOW_SEC = { "1H": 3_600, "24H": 86_400, "1W": 604_800, "1M": 2_592_000, ALL: 31_536_000 } as const;
type Timeframe = keyof typeof WINDOW_SEC;
const TIMEFRAMES = Object.keys(WINDOW_SEC) as Timeframe[];
const MS_PER_SECOND = 1000;
/** Samples across the window: the curve is a step line (the balance holds between account changes). */
const SAMPLES = 90;
const TICKS = 4;
const MIN_POINTS = 2;

const CLOCK: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hour12: false };
const TICK_FORMAT: Record<Timeframe, Intl.DateTimeFormatOptions> = {
  "1H": CLOCK,
  "24H": CLOCK,
  "1W": { weekday: "short" },
  "1M": { day: "numeric", month: "short" },
  ALL: { day: "numeric", month: "short" },
};
const STAMP: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", ...CLOCK };

const fmt = (ms: number, options: Intl.DateTimeFormatOptions) => new Date(ms).toLocaleString(LOCALE, options);

/**
 * The indexed snapshots (one per account change) as an evenly-timed step series from the first snapshot in the window
 * to now, so the chart's evenly spread ticks are true times. Plot numbers only; the figure above it stays bigint.
 */
function frameOf(id: Timeframe, points: Curve, nowMs: number): EquityFrame {
  const startMs = (points[0]?.timestamp ?? 0) * MS_PER_SECOND;
  const span = Math.max(1, nowMs - startMs);
  const times = Array.from({ length: SAMPLES }, (_, i) => startMs + (span * i) / (SAMPLES - 1));
  let at = 0;
  const values = times.map((t) => {
    while (at + 1 < points.length && (points[at + 1]?.timestamp ?? 0) * MS_PER_SECOND <= t) at += 1;
    return toPlot(points[at]?.equityInit ?? 0n, DECIMALS.usd6);
  });
  const ticks = Array.from({ length: TICKS }, (_, i) => fmt(startMs + (span * i) / (TICKS - 1), TICK_FORMAT[id]));
  return { id, values, ticks, stamp: (i) => fmt(times[i] ?? nowMs, STAMP) };
}

const formatValue = (n: number, digits: number) =>
  `${MONEY}${n.toLocaleString(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

/** The balance's curve (F16, the phone's `BalanceCurve`): one window at a time; the pills stay put while it loads. */
export function EquityCurve({ address }: { address: Address }) {
  const env = useQueryEnv();
  const [frame, setFrame] = useState<Timeframe>("24H");
  const curve = useEquityHistory(address, WINDOW_SEC[frame]);
  const retry = useRetry(keys.account(env.chainId, address));
  const points = curve.status === "fresh" || curve.status === "stale" ? curve.value : undefined;
  const at = curve.status === "fresh" || curve.status === "stale" ? curve.at : 0;
  const frames = useMemo(
    () => (points && points.length >= MIN_POINTS ? [frameOf(frame, points, at)] : []),
    [points, frame, at],
  );
  return (
    <div>
      <div className="flex min-h-68 flex-col justify-center">
        <ReadingView
          reading={curve}
          loadingLabel="Loading balance history"
          retry={retry}
          className="px-2"
          skeleton={<Skeleton className="h-52 w-full" />}
        >
          {() =>
            frames.length === 0 ? (
              <p className="px-2 text-center text-caption text-muted-foreground">
                The chart starts with your first deposit or trade.
              </p>
            ) : (
              <BalanceChart frames={frames} pills={false} formatValue={formatValue} />
            )
          }
        </ReadingView>
      </div>
      <FramePills ids={TIMEFRAMES} value={frame} onChange={(id) => setFrame(id as Timeframe)} />
    </div>
  );
}
