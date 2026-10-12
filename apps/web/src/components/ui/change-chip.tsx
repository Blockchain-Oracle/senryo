"use client";
/**
 * "↑ +2.34% · 24h" (D-319, F7): the 24-hour change against the price 24 hours ago on a tinted plate in the direction's
 * colour (no border, D-196), grey when level. Reads the live price sampled once a second, like the row's sparkline.
 */
import { type DayLine, dayChange } from "@senryo/calls";
import { useSampledPrice } from "@senryo/live/react";
import { cn } from "@/lib/utils";

const TAIL_MS = 1_000;
const TONE_CLASS = {
  up: "bg-up-surface text-up",
  down: "bg-down-surface text-down",
  flat: "bg-secondary text-text-2",
} as const;

export function ChangeChip({
  symbol,
  day,
  suffix = true,
  className,
}: {
  symbol: string;
  day: DayLine;
  /** " · 24h" after the figure (rows say it once in their header instead). */
  suffix?: boolean;
  className?: string;
}) {
  const nowE8 = useSampledPrice(symbol, TAIL_MS);
  if (nowE8 === undefined) return null;
  const c = dayChange(day.openE8, nowE8);
  return (
    <span
      className={cn(
        "tnum inline-flex h-6 items-center rounded-md px-1.5 font-semibold text-label",
        TONE_CLASS[c.tone],
        className,
      )}
    >
      {c.text}
      {suffix ? <span className="ml-1 font-medium opacity-70">24h</span> : null}
    </span>
  );
}
