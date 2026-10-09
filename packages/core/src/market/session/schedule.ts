/**
 * A market's trading hours, read from the feed's own Pyth schedule (D-289): `America/New_York;Mon,…,Sun;MMDD/day,…`
 * where a day is `O` (open), `C` (closed) or spans like `0930-1600` / `0000-1700&1800-2400`, and the dated entries
 * override the week (holidays, early closes). The price only moves while the feed publishes, so this is the session.
 * US Eastern time is computed from the federal rule (no `Intl`, which the phone's engine supports unevenly).
 */
import {
  CLOSED_ALL_DAY,
  DAYS_PER_WEEK,
  DST_END_MONTH,
  DST_END_SUNDAY,
  DST_END_UTC_HOUR,
  DST_START_MONTH,
  DST_START_SUNDAY,
  DST_START_UTC_HOUR,
  EDT_OFFSET_SEC,
  EPOCH_WEEKDAY_FROM_MONDAY,
  EST_OFFSET_SEC,
  HHMM_HOURS_DIVISOR,
  MINUTES_PER_DAY,
  MINUTES_PER_HOUR,
  MS_PER_SECOND,
  OPEN_ALL_DAY,
  SEARCH_DAYS,
  SECONDS_PER_DAY,
  SECONDS_PER_MINUTE,
  SLOT_SECONDS,
  SUNDAY,
} from "./constants.ts";

/** Minutes of the local day, [from, to). */
export interface Span {
  from: number;
  to: number;
}

export interface Schedule {
  /** Monday first. */
  week: readonly (readonly Span[])[];
  /** "MMDD" → that date's spans (empty = closed all day). */
  dated: ReadonlyMap<string, readonly Span[]>;
}

const ALL_DAY: readonly Span[] = [{ from: 0, to: MINUTES_PER_DAY }];
const MMDD_DIGITS = 2;
const MONTH_OFFSET = 1;

function minutesOf(hhmm: string): number {
  const n = Number(hhmm);
  return Math.floor(n / HHMM_HOURS_DIVISOR) * MINUTES_PER_HOUR + (n % HHMM_HOURS_DIVISOR);
}

function spansOf(day: string): Span[] {
  if (day === OPEN_ALL_DAY) return [...ALL_DAY];
  if (day === CLOSED_ALL_DAY) return [];
  return day.split("&").map((part) => {
    const [a = "", b = ""] = part.split("-");
    return { from: minutesOf(a), to: minutesOf(b) };
  });
}

export function parseSchedule(text: string): Schedule {
  const [, weekPart = "", datedPart = ""] = text.split(";");
  const week = weekPart.split(",").map(spansOf);
  if (week.length !== DAYS_PER_WEEK) throw new Error(`schedule: ${week.length} days, expected 7`);
  const dated = new Map<string, Span[]>();
  for (const entry of datedPart.split(",").filter(Boolean)) {
    const [mmdd = "", day = ""] = entry.split("/");
    dated.set(mmdd, spansOf(day));
  }
  return { week, dated };
}

/** The UTC second of the n-th Sunday of a month at the given UTC hour. */
function nthSunday(year: number, month: number, n: number, utcHour: number): number {
  const first = new Date(Date.UTC(year, month, 1));
  const toSunday = (DAYS_PER_WEEK + SUNDAY - first.getUTCDay()) % DAYS_PER_WEEK;
  const day = 1 + toSunday + (n - 1) * DAYS_PER_WEEK;
  return Date.UTC(year, month, day, utcHour) / MS_PER_SECOND;
}

/** US Eastern offset from UTC at that instant, in seconds (−4 h in summer time, −5 h otherwise). */
export function easternOffsetSec(utcSec: number): number {
  const year = new Date(utcSec * MS_PER_SECOND).getUTCFullYear();
  const start = nthSunday(year, DST_START_MONTH, DST_START_SUNDAY, DST_START_UTC_HOUR);
  const end = nthSunday(year, DST_END_MONTH, DST_END_SUNDAY, DST_END_UTC_HOUR);
  return utcSec >= start && utcSec < end ? EDT_OFFSET_SEC : EST_OFFSET_SEC;
}

/** The Eastern calendar day (days since 1970-01-01 local) and minute of the day at a UTC second. */
export function easternClock(utcSec: number): { day: number; minute: number; weekday: number; mmdd: string } {
  const local = utcSec + easternOffsetSec(utcSec);
  const day = Math.floor(local / SECONDS_PER_DAY);
  const minute = Math.floor((local - day * SECONDS_PER_DAY) / SECONDS_PER_MINUTE);
  const weekday = (((day + EPOCH_WEEKDAY_FROM_MONDAY) % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  const d = new Date(day * SECONDS_PER_DAY * MS_PER_SECOND);
  const mm = String(d.getUTCMonth() + MONTH_OFFSET).padStart(MMDD_DIGITS, "0");
  const dd = String(d.getUTCDate()).padStart(MMDD_DIGITS, "0");
  return { day, minute, weekday, mmdd: `${mm}${dd}` };
}

/** The spans that apply on an Eastern day: its dated entry if it has one, else the week's. */
export function spansOn(s: Schedule, weekday: number, mmdd: string): readonly Span[] {
  return s.dated.get(mmdd) ?? s.week[weekday] ?? [];
}

export function isOpenAt(s: Schedule, utcSec: number): boolean {
  const c = easternClock(utcSec);
  return spansOn(s, c.weekday, c.mmdd).some((sp) => c.minute >= sp.from && c.minute < sp.to);
}

/** True when the schedule never closes (crypto). */
export function alwaysOpen(s: Schedule): boolean {
  return s.dated.size === 0 && s.week.every((d) => d.length === 1 && d[0]?.from === 0 && d[0].to === MINUTES_PER_DAY);
}

/**
 * The next instant the open/closed state flips, within `SEARCH_DAYS`, or null (always open, or closed that long).
 * Sessions change on 15-minute boundaries in Eastern time, which are 15-minute boundaries in UTC too.
 */
export function nextChange(s: Schedule, utcSec: number): number | null {
  if (alwaysOpen(s)) return null;
  const now = isOpenAt(s, utcSec);
  const first = Math.floor(utcSec / SLOT_SECONDS) * SLOT_SECONDS + SLOT_SECONDS;
  const last = utcSec + SEARCH_DAYS * SECONDS_PER_DAY;
  for (let t = first; t <= last; t += SLOT_SECONDS) {
    if (isOpenAt(s, t) !== now) return t;
  }
  return null;
}

/** True when every 15-minute slot of [start, end) is open — the chain's own test for opening a window. */
export function sessionCovers(s: Schedule, start: number, end: number): boolean {
  for (let t = start; t < end; t += SLOT_SECONDS) if (!isOpenAt(s, t)) return false;
  return isOpenAt(s, end - 1);
}

const parsed = new Map<string, Schedule>();

/** `parseSchedule`, once per schedule text (callers pass the catalogue's strings on every tick). */
export function scheduleOf(text: string): Schedule {
  let s = parsed.get(text);
  if (!s) {
    s = parseSchedule(text);
    parsed.set(text, s);
  }
  return s;
}
