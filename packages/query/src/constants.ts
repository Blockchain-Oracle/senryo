/** Timings of the query layer (ms unless stated). */

/** Fallback tick when there is no requestAnimationFrame (tests, workers). */
export const FRAME_FALLBACK_MS = 16;
/** A price older than this with no tick is shown as stale ("Updated 14:02 · refreshing"). */
export const PRICE_STALE_MS = 15_000;

/** Market params/book/oracle re-read while a screen shows them (the socket covers price ticks in between). */
export const MARKET_REFETCH_MS = 5_000;
/** Calendars change only by timelocked admin action or a guardian holiday. */
export const CALENDAR_STALE_MS = 600_000;
export const CANDLES_REFETCH_MS = 60_000;
/** Account reads between socket-driven invalidations (fallback when the socket is down). */
export const ACCOUNT_REFETCH_MS = 10_000;
export const GAS_REFETCH_MS = 15_000;

/** Engine socket: keep-alive and reconnect backoff. */
export const SOCKET_PING_MS = 25_000;
export const SOCKET_BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000] as const;

/** How far back the market chart loads (seconds) per candle interval. */
export const CANDLE_WINDOW_SEC = {
  300: 86_400,
  900: 259_200,
  3600: 1_209_600,
  14400: 4_838_400,
  86400: 31_536_000,
} as const;
