/** Timings of the query layer (ms unless stated). */

/** Fallback tick when there is no requestAnimationFrame (tests, workers). */
export const FRAME_FALLBACK_MS = 16;
/** A price older than this with no tick is shown as stale ("Updated 14:02 · refreshing"). */
export const PRICE_STALE_MS = 15_000;

/** Cached data turns "stale" after this many missed refetch intervals (or on a failed refresh), never on TanStack's
 * `isStale` timer — that flipped every cycle and remounted screens (S8.16a). */
export const STALE_AFTER_INTERVALS = 2;

/** Market params/book/oracle re-read while a screen shows them (the socket covers price ticks in between). */
export const MARKET_REFETCH_MS = 5_000;
/** Calendars change only by timelocked admin action or a guardian holiday. */
export const CALENDAR_STALE_MS = 600_000;
export const CANDLES_REFETCH_MS = 60_000;
/** Account reads between socket-driven invalidations (fallback when the socket is down). */
export const ACCOUNT_REFETCH_MS = 10_000;
export const GAS_REFETCH_MS = 15_000;
/** A trade's gas budget (limit × max fee) is re-estimated at most this often per market/side/position count. */
export const GAS_BUDGET_STALE_MS = 60_000;
/** Starter status changes only when the user claims (the claim flow invalidates it). */
export const STARTER_STALE_MS = 300_000;
/** Deposit inbox balance while its screen is open (arrival → crediting, S8.24). */
export const INBOX_REFETCH_MS = 5_000;
/** Re-register the inbox watch (api TTL 7 days) at most this often while its screen is open. */
export const INBOX_WATCH_REFRESH_MS = 3_600_000;
/** Indexed equity curve (the socket invalidates the account on finalized changes). */
export const EQUITY_REFETCH_MS = 60_000;

/** J11 spot-token mid prices (one multicall of slot0s) while a token surface is open. */
export const SPOT_PRICE_REFETCH_MS = 10_000;
/** A spot ticket re-quotes this often (the same cadence as the collateral swap sheet). */
export const SPOT_QUOTE_REFRESH_MS = 10_000;
/** Spot holdings between swap-driven invalidations. */
export const SPOT_HOLDINGS_REFETCH_MS = 30_000;
/**
 * Spot-token candles from GeckoTerminal's keyless API (10 calls/min per IP on the free tier): one chart refreshes once
 * a minute, so a token page never spends more than a tenth of the device's allowance.
 */
export const SPOT_CANDLES_REFETCH_MS = 60_000;
/** The list's 24 h line (one GeckoTerminal call for every token; its free tier allows ~10 a minute per IP). */
export const SPOT_STATS_REFETCH_MS = 60_000;

/**
 * Discovery quotes (review S03): Perpl's markets (one multicall + Perpl's keyless ticker) and the calculated feeds
 * (one multicall + the 24 h search, usually one more call) while a markets surface is open.
 */
export const DISCOVERY_QUOTES_REFETCH_MS = 10_000;
export const DISCOVERY_CANDLES_REFETCH_MS = 60_000;
/** The wallet's Perpl account/positions (direct onchain reads) between send-driven invalidations. */
export const PERPL_ACCOUNT_REFETCH_MS = 10_000;
/** A Perpl market's order terms (mark, max leverage, fee) and the Exchange's halt flag while a ticket is open. */
export const PERPL_TERMS_REFETCH_MS = 5_000;
/** Every Perpl market's base max leverage (the Markets badges): owner-set, so a slow refresh is enough. */
export const PERPL_CAPS_REFETCH_MS = 60_000;
/** Perpl's `/v1/pub/context` (funding intervals) is re-read at most this often. */
export const PERPL_CONTEXT_TTL_MS = 600_000;
/** A Perpl REST call that takes longer is "didn't answer" (the onchain price beside it still shows). */
export const PERPL_HTTP_TIMEOUT_MS = 6_000;
/**
 * Onchain rounds a calculated-feed chart reads back at most, per feed, while the indexer doesn't index these feeds:
 * ≈ 13 days of the busiest feed (wEWYx ≈ 450 rounds/day, D-220), the whole of SPY's ≈ 80/day life so far.
 */
export const FEED_HISTORY_MAX_ROUNDS = 6_000;

/** Any-asset (D6/D2): holdings match the api's ~20 s cache; quotes re-fetch while a ticket or review is open. */
export const HOLDINGS_REFETCH_MS = 20_000;
export const SWAP_QUOTE_REFETCH_MS = 10_000;
/** The route table changes only with a release (Aurora's incident state rides along). */
export const BRIDGE_ROUTES_STALE_MS = 300_000;
export const BRIDGE_QUOTE_REFETCH_MS = 15_000;
/** A sent transfer's status is polled at this pace until it is delivered, refunded or failed. */
export const BRIDGE_STATUS_REFETCH_MS = 5_000;

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
