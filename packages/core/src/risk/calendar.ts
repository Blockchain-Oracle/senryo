/**
 * Market-session calendar for display ("Gold opens Sun 23:00 UTC · in 14h 02m") — a port of `MarketCalendar.sol`:
 * 672 fifteen-minute slots per week in 3 × uint256 (bit 1 = open; slot 0 = Monday 00:00 UTC at `WEEK_ANCHOR`) plus
 * holiday windows. **Display only:** the onchain `SessionOracle` status decides what can trade.
 */
import { RISK } from "./constants.ts";

export interface CalendarWindow {
  start: bigint;
  end: bigint;
}

export interface WeekCalendar {
  /** `MarketCalendar.week(id)` — three 256-bit words. */
  week: readonly [bigint, bigint, bigint];
  /** `MarketCalendar.holidays(id)` — closed windows `[start, end)`. */
  holidays: readonly CalendarWindow[];
}

const { WEEK_ANCHOR, SECONDS_PER_WEEK, SLOT_SECONDS, SLOTS_PER_WORD, SLOTS_PER_WEEK } = RISK;
/** Look this far ahead for the next open/close (two weeks covers a holiday on top of a weekend). */
const HORIZON_SLOTS = SLOTS_PER_WEEK * 2n;

export function slotOf(timestamp: bigint): bigint {
  return ((timestamp - WEEK_ANCHOR) % SECONDS_PER_WEEK) / SLOT_SECONDS;
}

export function isOpenAt(cal: WeekCalendar, timestamp: bigint): boolean {
  if (timestamp < WEEK_ANCHOR) return false;
  const slot = slotOf(timestamp);
  const word = cal.week[Number(slot / SLOTS_PER_WORD)] ?? 0n;
  if (((word >> (slot % SLOTS_PER_WORD)) & 1n) === 0n) return false;
  return !cal.holidays.some((h) => h.start <= timestamp && timestamp < h.end);
}

/** Start of the slot containing `timestamp`. */
function slotStart(timestamp: bigint): bigint {
  return timestamp - ((timestamp - WEEK_ANCHOR) % SLOT_SECONDS);
}

/**
 * First moment ≥ `from` when the calendar is `open` (or closed, with `open = false`), checking slot boundaries and
 * holiday edges; undefined when it doesn't happen within two weeks.
 */
export function nextTransition(cal: WeekCalendar, from: bigint, open: boolean): bigint | undefined {
  if (isOpenAt(cal, from) === open) return from;
  const candidates: bigint[] = [];
  const first = slotStart(from) + SLOT_SECONDS;
  for (let i = 0n; i < HORIZON_SLOTS; i += 1n) candidates.push(first + i * SLOT_SECONDS);
  for (const h of cal.holidays) {
    if (h.start > from) candidates.push(h.start);
    if (h.end > from) candidates.push(h.end);
  }
  candidates.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return candidates.find((t) => isOpenAt(cal, t) === open);
}

/** The next closed window starting at or after `from` (e.g. a holiday banner days ahead, F43). */
export function nextHoliday(cal: WeekCalendar, from: bigint): CalendarWindow | undefined {
  return [...cal.holidays]
    .filter((h) => h.end > from)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))[0];
}
