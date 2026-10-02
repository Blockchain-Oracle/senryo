export const MS_PER_SECOND = 1_000;
/** The loader's elapsed counter refreshes at a tenth of a second. */
export const ELAPSED_TICK_MS = 100;
/** Toasts stay 5 s (ported Base UI default). */
export const TOAST_LIFETIME_MS = 5_000;
/** Every query is fresh for 5 s and retried once (ported defaults; S6+ tunes per key). */
export const QUERY_STALE_MS = 5_000;
export const QUERY_RETRIES = 1;
