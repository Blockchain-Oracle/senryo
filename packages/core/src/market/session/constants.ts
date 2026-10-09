/** Session maths (D-289): Pyth schedule strings, US Eastern time, and `MarketCalendar`'s slot layout. */

export const MS_PER_SECOND = 1000;
export const SECONDS_PER_MINUTE = 60;
export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = 1440;
export const SECONDS_PER_DAY = 86_400;
export const DAYS_PER_WEEK = 7;
export const SECONDS_PER_WEEK = 604_800;

/** 1970-01-01 was a Thursday: index 3 when Monday is 0. */
export const EPOCH_WEEKDAY_FROM_MONDAY = 3;

/** US Eastern: UTC−5, or UTC−4 from the second Sunday of March 02:00 to the first Sunday of November 02:00. */
export const EST_OFFSET_SEC = -5 * 3600;
export const EDT_OFFSET_SEC = -4 * 3600;
export const DST_START_MONTH = 2; // March, 0-based
export const DST_START_SUNDAY = 2; // the second Sunday
export const DST_END_MONTH = 10; // November, 0-based
export const DST_END_SUNDAY = 1; // the first Sunday
/** The switch happens at 02:00 local: 07:00 UTC in March (from EST), 06:00 UTC in November (from EDT). */
export const DST_START_UTC_HOUR = 7;
export const DST_END_UTC_HOUR = 6;
export const SUNDAY = 0; // `Date#getUTCDay`

/** Mirrors contracts `Constants`: slot 0 = Monday 00:00 UTC, 15-minute slots, 256 per word, 3 words. */
export const WEEK_ANCHOR_SEC = 345_600;
export const SLOT_SECONDS = 900;
export const SLOTS_PER_WEEK = 672;
export const SLOTS_PER_WORD = 256;
export const CALENDAR_WORDS = 3;
export const MAX_HOLIDAYS = 32;

/** How far ahead a next open/close is searched (a long weekend plus a holiday fits easily). */
export const SEARCH_DAYS = 14;

/** Schedule tokens: "O" open all day, "C" closed, "HHMM-HHMM" spans joined by "&"; "2400" is the end of the day. */
export const OPEN_ALL_DAY = "O";
export const CLOSED_ALL_DAY = "C";
export const HHMM_HOURS_DIVISOR = 100;
