"use client";
/**
 * A pool share's value over time (P5, D-325; the phone's `EarnChart`): the hourly rolls' value ÷ supply, closed by the
 * value now, as an SVG line with a faint fill (`@senryo/calls` `seriesGeometry`). Hover or drag across to read any
 * hour. Fewer than two hours: a line saying the chart starts after the first settled hour.
 */
import { plotValue, type SharePoint, seriesGeometry, shareChartBounds, sharePriceText } from "@senryo/calls";
import { useState } from "react";
import { cn } from "@/lib/utils";

const W = 600;
const H = 160;
const PAD = 12;
const MS = 1000;
const HHMM = 5;
const TIME_START = 11;
const DATE_LEN = 10;

const timeOf = (hour: number, long: boolean) => {
  const iso = new Date(hour * MS).toISOString();
  const hhmm = iso.slice(TIME_START, TIME_START + HHMM);
  return long ? `${iso.slice(0, DATE_LEN)} ${hhmm} UTC` : `${hhmm} UTC`;
};

export function EarnChart({
  series,
  tone,
  longRange,
}: {
  series: readonly SharePoint[];
  tone: "up" | "down" | "muted";
  longRange: boolean;
}) {
  const [at, setAt] = useState<number | null>(null);
  const g = seriesGeometry(
    series.map((p) => plotValue(p.e12)),
    W,
    H,
    PAD,
    shareChartBounds(series),
  );
  const last = series.length - 1;
  const shown = at === null ? series[last] : series[at];
  if (!g || series.length < 2) {
    return (
      <div className="grid h-40 place-items-center rounded-2xl bg-secondary p-6 text-center text-meta text-text-3">
        The line starts after the pool's first settled hour.
      </div>
    );
  }
  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    setAt(Math.max(0, Math.min(last, Math.round(((e.clientX - box.left) / box.width) * last))));
  };
  const stroke = tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-foreground";
  return (
    <div className="flex flex-col gap-1">
      <p aria-live="polite" className="tnum text-meta text-text-3">
        {shown ? `${at === null ? "Now" : timeOf(shown.hour, longRange)} · ${sharePriceText(shown.e12)} a share` : ""}
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`A share's value, from ${sharePriceText(series[0]?.e12 ?? 0n)} to ${sharePriceText(series[last]?.e12 ?? 0n)}`}
        className={cn("h-40 w-full touch-none", stroke)}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setAt(null)}
      >
        <path d={g.area} className="fill-current opacity-10" />
        <path
          d={g.d}
          className="fill-none stroke-current"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
        {at !== null && series[at] ? (
          <>
            <line
              x1={g.x(at)}
              x2={g.x(at)}
              y1={0}
              y2={H}
              className="stroke-current opacity-30"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={g.x(at)} cy={g.y(plotValue(series[at]?.e12 ?? 0n))} r={4} className="fill-current" />
          </>
        ) : null}
      </svg>
    </div>
  );
}
