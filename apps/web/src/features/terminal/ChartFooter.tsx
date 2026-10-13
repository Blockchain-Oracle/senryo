"use client";
/**
 * The chart's footer (R5.17; Tradash's chart controls by way of Owarine's `ChartControls.tsx`): the view — Line or
 * Candles — the candles' interval while they show, and the music toggle with its track chip.
 */
import { CANDLE_INTERVALS, type CandleInterval } from "@senryo/calls";
import { CandlestickChart, ChartSpline } from "lucide-react";
import { fire } from "@/lib/feedback";
import { cn } from "@/lib/utils";
import { MusicToggle } from "./MusicToggle";

export function ChartFooter({
  candles,
  interval,
  onCandles,
  onInterval,
}: {
  candles: boolean;
  interval: CandleInterval;
  onCandles: (on: boolean) => void;
  onInterval: (i: CandleInterval) => void;
}) {
  const pick = (on: boolean) => {
    fire("tick", { cue: "toggle" });
    onCandles(on);
  };
  return (
    <div className="chart-footer">
      <div className="chart-footer-group">
        <button
          type="button"
          aria-pressed={!candles}
          aria-label="Line"
          className={cn("chart-footer-chip", !candles && "is-on")}
          onClick={() => pick(false)}
        >
          <ChartSpline aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          aria-pressed={candles}
          aria-label="Candles"
          className={cn("chart-footer-chip", candles && "is-on")}
          onClick={() => pick(true)}
        >
          <CandlestickChart aria-hidden className="size-4" />
        </button>
        {candles
          ? CANDLE_INTERVALS.map((i) => (
              <button
                key={i}
                type="button"
                aria-pressed={i === interval}
                className={cn("chart-footer-chip tnum", i === interval && "is-on")}
                onClick={() => {
                  fire("tick", { cue: "toggle" });
                  onInterval(i);
                }}
              >
                {i}
              </button>
            ))
          : null}
      </div>
      <MusicToggle />
    </div>
  );
}
