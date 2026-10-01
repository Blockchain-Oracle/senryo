/**
 * Chart periods for the trade page (the phone's `periods.ts`, Fomo F32's period chips). Each period is one of the
 * candle sizes the indexer keeps, with the window `useCandles` loads for it (`CANDLE_WINDOW_SEC` in `@senryo/query`):
 * 5 m candles over a day, 15 m over three days, hourly over two weeks, 4 h over eight weeks, daily over a year. The
 * indexer returns at most 300 candles per request, so the caption names the candle size and the date the drawn data
 * starts — the label never claims more than is on screen.
 */
import type { CandleInterval } from "@senryo/indexer-client";

export type PeriodKey = "1D" | "3D" | "2W" | "8W" | "1Y";

export interface ChartPeriod {
  value: PeriodKey;
  label: string;
  interval: CandleInterval;
  /** The candle size as the caption words it. */
  candle: string;
  axis: "clock" | "weekday" | "date";
}

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

const CLOCK: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hour12: false };
const WEEKDAY: Intl.DateTimeFormatOptions = { weekday: "short", ...CLOCK };
const LOCALE = "en-GB";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** "30 Sep" in the viewer's local time (three-letter months, as on the phone). */
export function dayLabel(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()] ?? ""}`;
}

/** A date-axis tick for a period: "14:00" · "Tue 14:00" · "30 Sep". */
export function axisTimeLabel(axis: ChartPeriod["axis"], ms: number): string {
  if (axis === "clock") return new Date(ms).toLocaleTimeString(LOCALE, CLOCK);
  if (axis === "date") return dayLabel(ms);
  return new Date(ms).toLocaleString(LOCALE, WEEKDAY);
}
