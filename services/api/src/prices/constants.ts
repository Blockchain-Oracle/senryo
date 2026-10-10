/** The Pyth gateway's numbers (D-272). Hermes base, timings and retention live here and nowhere else. */

/**
 * Hermes's documented base since the 26 Aug 2026 upgrade (`hermes.pyth.network` fronts it); `HERMES_ORIGIN` in the env
 * overrides it. Probed 10 Oct with the key: streams, `channel` and `ignore_invalid_price_ids` all answer here.
 */
export const HERMES_ORIGIN = "https://pyth.dourolabs.app/hermes";
/** Named on every stream, so a plan change to 200 ms is one line (04-pricing R5g). Starter's rate is 1 s. */
export const HERMES_CHANNEL = "fixed_rate@1000ms";
/** A connection that hasn't answered with headers by now is abandoned (undici would wait 300 s). */
export const HERMES_HEADERS_TIMEOUT_MS = 5_000;
/** The reconnect backoff resets only after a connection has streamed this long (a 200-then-close loops otherwise). */
export const HERMES_HEALTHY_RESET_MS = 30_000;
/** Hermes keeps ~640 s in memory; the ring keeps a little less so any fill the relay asks for is still provable. */
export const RING_KEEP_SEC = 300;
/** One sample a second for first paint. */
export const RECENT_WINDOW_SEC = 300;
/** How long the relay waits for a fill print to stream in before falling back to the archive / REST. */
export const PRINT_WAIT_MS = 8_000;
/**
 * No frame for this long → the stream is dead; reconnect. Hermes's fixed-rate channel sends a frame a second even for
 * closed markets (their publish time frozen at the close — probed Saturday 10 Oct), so a quiet class is never idle.
 */
export const WATCHDOG_MS = 10_000;
export const SILENCE_CHECK_MS = 1_000;
/** Each market's state is judged this often (`FeedStates`, 04-pricing R6). */
export const FEED_STATE_STEP_MS = 1_000;
/** D-289: a Pyth price older than this while its market is open halts quoting and listing (never the chain). */
export const HALT_STALE_MS = 15_000;
/** D-289: a Pyth confidence wider than this share of the price (bps) halts it too. */
export const HALT_CONF_BPS = 50;
/** A display line that moved within this long keeps a late market in `fallback` rather than `delayed`/`stale`. */
export const DISPLAY_FRESH_MS = 2_000;
/** A display tick this fresh when a settlement update lands is a basis sample (display − settlement). */
export const BASIS_FRESH_MS = 1_000;
/** Jittered reconnect backoff bounds. */
export const BACKOFF_MIN_MS = 500;
export const BACKOFF_MAX_MS = 30_000;
/** Hermes closes a stream at 24 h; open the next one first, at 23 h 45 m. */
export const ROTATE_AFTER_MS = (23 * 60 + 45) * 60 * 1000;
/** Window boundaries are archived on every minute (all cadences divide one hour). */
export const BOUNDARY_SEC = 60;
/** A candle with no next minute is closed this long after its minute ends (late frames still fold in). */
export const CANDLE_CLOSE_GRACE_SEC = 5;
/** Every feed that moved goes out in one batched frame this often (04-pricing R13): ≤ 10 Hz per feed. */
export const TICK_FLUSH_MS = 100;
/** How often the print watch looks for instants a position needs that never archived (04-pricing R3). */
export const PRINT_WATCH_MS = 2_000;
/** A print still missing past this share of its market's admission is logged as an error: its windows will void. */
export const PRINT_WATCH_NEARING_SHARE = 0.5;
/** A REST lookup for a print that never streamed. */
export const REST_TIMEOUT_MS = 4_000;
/** Never ask upstream for the print of t before t + this: Pyth's first publish ≥ t lands about a second after t. */
export const PRINT_GRACE_SEC = 2;
/** Kept in `pyth_prints` (window boundaries and fills): the chain holds them forever; the archive serves proofs. */
export const PRINT_RETENTION_DAYS = 14;

// ------------------------------------------------------------------------------------------------ RedStone (D-284)

/** RedStone's production data service and its public gateways (refusing in growing windows until 29 Oct 2026). */
export const REDSTONE_SERVICE = "redstone-primary-prod";
export const REDSTONE_PUBLIC_GATEWAYS = [
  "https://oracle-gateway-2.a.redstone.finance",
  "https://oracle-gateway-1.a.redstone.finance",
];
/**
 * Packages are signed on a 10-second grid and appear on the gateway 4.2–6.5 s after their grid point (measured 10 Oct,
 * gateway-2 sampled every 0.7 s); each is read 7 s after its point. (2.5 s, the old offset, always read the previous one.)
 */
export const REDSTONE_GRID_MS = 10_000;
export const REDSTONE_POLL_OFFSET_MS = 7_000;
/** A fill's RedStone print can be up to one grid step away, plus its arrival and the read. */
export const REDSTONE_PRINT_WAIT_MS = 20_000;
export const REDSTONE_FETCH_TIMEOUT_MS = 8_000;
export const REDSTONE_BACKOFF_MIN_MS = 60_000;
export const REDSTONE_BACKOFF_MAX_MS = 600_000;
/** A parse in the worker takes ~25 ms; one this late means the worker is stuck: it is restarted. */
export const REDSTONE_PARSE_TIMEOUT_MS = 5_000;
/** After this many worker deaths the parse moves back to the main thread (slow beats none). */
export const REDSTONE_PARSE_WORKER_MAX_FAILURES = 3;

// ------------------------------------------------------------------------------------- PrintFetcher (04-pricing R2)

/** Hermes REST for prints the stream missed: 1 a second with bursts of 5 (`pivot-2026-10-08.md` "Stack"). */
export const HERMES_REST_RATE_PER_SEC = 1;
export const HERMES_REST_BURST = 5;
/** RedStone's keyed gateway allows about 1 request a second per key; history reads take at most half of it. */
export const REDSTONE_HISTORY_RATE_PER_SEC = 0.5;
export const REDSTONE_HISTORY_BURST = 1;
/** One `historical` read (~2 MB, every feed) serves every RedStone print at its grid point for this long. */
export const REDSTONE_HISTORY_CACHE_MS = 60_000;
/** A caller waits at most this long for a rate token; past it the call is refused (counted) and its own retry decides. */
export const PRINT_FETCH_MAX_QUEUE_MS = 3_000;
/** Asks for one instant arriving this close together share one Hermes call (one per entitlement class). */
export const PRINT_BATCH_COLLECT_MS = 25;
/** A failing REST source rests, doubling — its own backoff, apart from the live stream's and the live poll's. */
export const PRINT_FETCH_BACKOFF_MIN_MS = 5_000;
export const PRINT_FETCH_BACKOFF_MAX_MS = 120_000;
