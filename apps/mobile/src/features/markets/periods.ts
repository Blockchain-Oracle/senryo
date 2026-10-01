/**
 * Chart periods for market detail (Fomo F32's period chips). Each period is one of the candle sizes the indexer keeps
 * with the window `useCandles` loads for it (`CANDLE_WINDOW_SEC` in `@senryo/query`): 5 m candles over a day, 15 m
 * over three days, hourly over two weeks, 4 h over eight weeks, daily over a year. The indexer returns at most 300
 * candles per request, so the longer periods show their newest 300; the chart's caption names the candle size and the
 * date the drawn data starts, so the label never claims more than is on screen.
 */
import type { CandleInterval } from "@senryo/indexer-client";
import { clockTime } from "~/lib/format";

export type PeriodKey = "1D" | "3D" | "2W" | "8W" | "1Y";

export interface ChartPeriod {
  value: PeriodKey;
  label: string;
  /** Candle size in seconds (an indexer interval). */
  interval: CandleInterval;
  /** The candle size as the caption words it. */
  candle: string;
  /** How the time axis is labelled: clock time, weekday + time, or day + month. */
  axis: "clock" | "weekday" | "date";
}

/** Three days of 15-minute candles: what market detail has always opened on. */
const THREE_DAYS: ChartPeriod = { value: "3D", label: "3D", interval: 900, candle: "15m", axis: "weekday" };
export const DEFAULT_PERIOD: PeriodKey = THREE_DAYS.value;

export const CHART_PERIODS: readonly ChartPeriod[] = [
  { value: "1D", label: "1D", interval: 300, candle: "5m", axis: "clock" },
  THREE_DAYS,
  { value: "2W", label: "2W", interval: 3600, candle: "1h", axis: "date" },
  { value: "8W", label: "8W", interval: 14400, candle: "4h", axis: "date" },
  { value: "1Y", label: "1Y", interval: 86400, candle: "1d", axis: "date" },
];

export function periodOf(key: PeriodKey): ChartPeriod {
  return CHART_PERIODS.find((p) => p.value === key) ?? THREE_DAYS;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** "30 Sep" in the device's local time. */
export function dayLabel(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()] ?? ""}`;
}

/** A time-axis tick for a period: "14:00" · "Tue 14:00" · "30 Sep". */
export function axisTimeLabel(axis: ChartPeriod["axis"], ms: number): string {
  if (axis === "clock") return clockTime(ms);
  if (axis === "date") return dayLabel(ms);
  return `${WEEKDAYS[new Date(ms).getDay()] ?? ""} ${clockTime(ms)}`;
}
