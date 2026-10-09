/**
 * A market's session in words for the terminal, Markets and Home (D-289): "Closes 16:00 ET", "Opens Mon 09:30 ET",
 * "Holiday · opens Fri 09:30 ET". Always-open markets (crypto) have no words. Times are US Eastern, 24-hour, as every
 * reference app writes them.
 */
import { MINUTES_PER_HOUR } from "./constants.ts";
import { alwaysOpen, easternClock, isOpenAt, nextChange, type Schedule, spansOn } from "./schedule.ts";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const PAD = 2;

export interface SessionNow {
  open: boolean;
  /** The next open or close (UTC seconds), or null when it never changes in the search horizon. */
  nextSec: number | null;
  /** Null for an always-open market. */
  text: string | null;
  /** Closed today although the week says this weekday trades (a dated entry). */
  holiday: boolean;
}

function hhmm(minute: number): string {
  const h = Math.floor(minute / MINUTES_PER_HOUR);
  const m = minute % MINUTES_PER_HOUR;
  return `${String(h).padStart(PAD, "0")}:${String(m).padStart(PAD, "0")}`;
}

/** "16:00 ET" on the same Eastern day, else "Fri 17:00 ET". */
export function easternWhen(atSec: number, nowSec: number): string {
  const at = easternClock(atSec);
  const now = easternClock(nowSec);
  const time = `${hhmm(at.minute)} ET`;
  return at.day === now.day ? time : `${WEEKDAYS[at.weekday]} ${time}`;
}

export function sessionNow(s: Schedule, nowSec: number): SessionNow {
  if (alwaysOpen(s)) return { open: true, nextSec: null, text: null, holiday: false };
  const open = isOpenAt(s, nowSec);
  const nextSec = nextChange(s, nowSec);
  const c = easternClock(nowSec);
  const holiday = !open && (s.week[c.weekday]?.length ?? 0) > 0 && spansOn(s, c.weekday, c.mmdd).length === 0;
  if (nextSec === null) return { open, nextSec, text: open ? "Open" : "Closed", holiday };
  const when = easternWhen(nextSec, nowSec);
  if (open) return { open, nextSec, text: `Closes ${when}`, holiday };
  return { open, nextSec, text: holiday ? `Holiday · opens ${when}` : `Opens ${when}`, holiday };
}
