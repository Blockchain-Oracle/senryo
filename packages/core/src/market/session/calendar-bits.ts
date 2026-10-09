/**
 * A schedule in `MarketCalendar`'s terms (D-289): the weekly bitmap for one US Eastern offset (a slot is open only if
 * all 15 minutes of it are), and the dated entries as closed UTC windows (`addHoliday`). The week ignores dated
 * entries; a holiday or early close is the part of that day's usual session the dated entry takes away.
 */
import {
  CALENDAR_WORDS,
  DAYS_PER_WEEK,
  EST_OFFSET_SEC,
  MINUTES_PER_DAY,
  SECONDS_PER_DAY,
  SECONDS_PER_MINUTE,
  SECONDS_PER_WEEK,
  SLOT_SECONDS,
  SLOTS_PER_WEEK,
  SLOTS_PER_WORD,
} from "./constants.ts";
import { easternClock, easternOffsetSec, type Schedule, type Span } from "./schedule.ts";

const SLOT_MINUTES = SLOT_SECONDS / SECONDS_PER_MINUTE;

function covers(spans: readonly Span[], from: number, to: number): boolean {
  return spans.some((s) => s.from <= from && to <= s.to);
}

/** The week's bitmap at a fixed Eastern offset: word w, bit b = slot w × 256 + b (slot 0 = Monday 00:00 UTC). */
export function weekBits(s: Schedule, offsetSec: number): bigint[] {
  const words = Array.from({ length: CALENDAR_WORDS }, () => 0n);
  for (let slot = 0; slot < SLOTS_PER_WEEK; slot++) {
    const local = (((slot * SLOT_SECONDS + offsetSec) % SECONDS_PER_WEEK) + SECONDS_PER_WEEK) % SECONDS_PER_WEEK;
    const weekday = Math.floor(local / SECONDS_PER_DAY);
    const minute = (local % SECONDS_PER_DAY) / SECONDS_PER_MINUTE;
    if (!covers(s.week[weekday] ?? [], minute, minute + SLOT_MINUTES)) continue;
    const w = Math.floor(slot / SLOTS_PER_WORD);
    words[w] = (words[w] ?? 0n) | (1n << BigInt(slot % SLOTS_PER_WORD));
  }
  return words;
}

/** Minutes of a day open under `usual` but not under `actual`, as maximal spans. */
function removed(usual: readonly Span[], actual: readonly Span[]): Span[] {
  const out: Span[] = [];
  let open: number | null = null;
  for (let m = 0; m <= MINUTES_PER_DAY; m++) {
    const gone = m < MINUTES_PER_DAY && covers(usual, m, m + 1) && !covers(actual, m, m + 1);
    if (gone && open === null) open = m;
    if (!gone && open !== null) {
      out.push({ from: open, to: m });
      open = null;
    }
  }
  return out;
}

export interface ClosedWindow {
  start: number;
  end: number;
}

/**
 * Closed UTC windows for the dated entries that fall in [fromSec, fromSec + days): holidays close the whole usual
 * session, early closes its tail. Adjacent windows (a holiday followed by a usual overnight close) stay separate; the
 * contract only needs each one closed.
 */
export function holidayWindows(s: Schedule, fromSec: number, days: number): ClosedWindow[] {
  const out: ClosedWindow[] = [];
  const firstDay = easternClock(fromSec).day;
  for (let d = firstDay; d < firstDay + days; d++) {
    // The day's offset, read at its local noon (daylight saving changes at 02:00, never near a session edge).
    const localNoon = d * SECONDS_PER_DAY + SECONDS_PER_DAY / 2;
    const offset = easternOffsetSec(localNoon - EST_OFFSET_SEC);
    const c = easternClock(localNoon - offset);
    const actual = s.dated.get(c.mmdd);
    if (!actual) continue;
    const usual = s.week[c.weekday % DAYS_PER_WEEK] ?? [];
    for (const span of removed(usual, actual)) {
      const start = d * SECONDS_PER_DAY + span.from * SECONDS_PER_MINUTE - offset;
      const end = d * SECONDS_PER_DAY + span.to * SECONDS_PER_MINUTE - offset;
      if (end > fromSec) out.push({ start, end });
    }
  }
  return out;
}
