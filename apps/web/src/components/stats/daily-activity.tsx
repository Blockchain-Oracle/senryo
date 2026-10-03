"use client";

/**
 * Per day since launch (D-022): new accounts and trades as two small multiples on one day axis (two measures, two
 * scales — never one chart with a second axis). Hovering or tapping a day in either chart moves one shared legend; with
 * no hover it holds today, marked "so far" and hatched in the columns. A visually hidden table carries every value.
 */
import type { ChainId } from "@senryo/config";
import { useMemo, useState } from "react";
import { QuietLine } from "@/components/kit/list-row";
import { DailyBars } from "@/components/ui/daily-bars";
import { Skeleton } from "@/components/ui/skeleton";
import { STATS_DAYS_MAX_PAGES, STATS_DAYS_PAGE } from "@/lib/constants/stats";
import { type DayPoint, dailySeries, dayLabel, todayIndex, useProtocolDays } from "@/lib/stats/traction";
import { formatCount } from "./format";

function Series({
  title,
  values,
  value,
  focus,
  onFocus,
  partialLast,
  color,
}: {
  title: string;
  values: readonly number[];
  value: number;
  focus: number | undefined;
  onFocus: (i: number | undefined) => void;
  partialLast: boolean;
  color: string;
}) {
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between text-meta">
        <span className="text-text-2">{title}</span>
        <span className="text-foreground tnum">{formatCount(value)}</span>
      </div>
      <DailyBars
        label={title}
        values={values}
        focus={focus}
        onFocus={onFocus}
        partialLast={partialLast}
        color={color}
      />
    </div>
  );
}

function DayTable({ series }: { series: readonly DayPoint[] }) {
  return (
    <table className="sr-only">
      <caption>New accounts and trades per UTC day</caption>
      <thead>
        <tr>
          <th scope="col">Day</th>
          <th scope="col">New accounts</th>
          <th scope="col">Trades</th>
        </tr>
      </thead>
      <tbody>
        {series.map((p) => (
          <tr key={p.day}>
            <th scope="row">{dayLabel(p.day)}</th>
            <td>{p.accounts}</td>
            <td>{p.trades}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DailyActivity({ chainId, color }: { chainId: ChainId; color: string }) {
  const days = useProtocolDays(chainId);
  const [focus, setFocus] = useState<number>();
  const loadedAt = days.dataUpdatedAt;
  const series = useMemo(() => (days.data ? dailySeries(days.data.rows, loadedAt) : []), [days.data, loadedAt]);

  if (days.isPending) return <Skeleton className="h-72 w-full" />;
  if (days.isError)
    return (
      <QuietLine action={{ label: "Retry", onClick: () => void days.refetch() }}>
        Couldn’t reach the indexer for the daily series
      </QuietLine>
    );
  const first = series[0];
  const last = series.at(-1);
  if (!first || !last) return <QuietLine>No days indexed on this network yet</QuietLine>;

  const today = todayIndex(loadedAt);
  const partialLast = last.day === today;
  const point = series[focus ?? series.length - 1] ?? last;

  return (
    <section aria-labelledby="per-day" className="grid gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 id="per-day" className="text-section-title">
            Per day
          </h2>
          <p className="text-meta text-text-3">Since {dayLabel(first.day)} · UTC</p>
        </div>
        <p className="text-meta text-text-2 tnum">
          {dayLabel(point.day)}
          {point.day === today ? " · so far" : ""}
        </p>
      </div>
      <Series
        title="New accounts"
        values={series.map((p) => p.accounts)}
        value={point.accounts}
        focus={focus}
        onFocus={setFocus}
        partialLast={partialLast}
        color={color}
      />
      <Series
        title="Trades"
        values={series.map((p) => p.trades)}
        value={point.trades}
        focus={focus}
        onFocus={setFocus}
        partialLast={partialLast}
        color={color}
      />
      <div className="-mt-2 flex justify-between text-micro text-text-3">
        <span>{dayLabel(first.day)}</span>
        <span>{partialLast ? "Today" : dayLabel(last.day)}</span>
      </div>
      <DayTable series={series} />
      {days.data.complete ? null : (
        <p className="text-meta text-warn">First {formatCount(STATS_DAYS_PAGE * STATS_DAYS_MAX_PAGES)} days shown</p>
      )}
    </section>
  );
}
