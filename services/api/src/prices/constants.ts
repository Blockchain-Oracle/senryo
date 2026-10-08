/** The Pyth gateway's numbers (D-272). Hermes base, timings and retention live here and nowhere else. */

export const HERMES_ORIGIN = "https://hermes.pyth.network";
/** Hermes keeps ~640 s in memory; the ring keeps a little less so any fill the relay asks for is still provable. */
export const RING_KEEP_SEC = 300;
/** One sample a second for first paint. */
export const RECENT_WINDOW_SEC = 300;
/** How long the relay waits for a fill print to stream in before falling back to the archive / REST. */
export const PRINT_WAIT_MS = 8_000;
/** No frame for this long → the stream is dead; reconnect. */
export const WATCHDOG_MS = 10_000;
/** Jittered reconnect backoff bounds. */
export const BACKOFF_MIN_MS = 500;
export const BACKOFF_MAX_MS = 30_000;
/** Hermes closes a stream at 24 h; open the next one first, at 23 h 45 m. */
export const ROTATE_AFTER_MS = (23 * 60 + 45) * 60 * 1000;
/** Window boundaries are archived on every minute (all cadences divide one hour). */
export const BOUNDARY_SEC = 60;
/** At most one price frame per feed per this many ms on `/v1/stream` (Owarine's coalescer). */
export const FRAME_GAP_MS = 125;
/** A REST lookup for a print that never streamed. */
export const REST_TIMEOUT_MS = 4_000;
/** Kept in `pyth_prints` (window boundaries and fills): the chain holds them forever; the archive serves proofs. */
export const PRINT_RETENTION_DAYS = 14;
