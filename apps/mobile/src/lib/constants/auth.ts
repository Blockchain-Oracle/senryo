/**
 * Mobile auth constants (S6). The rpId is `RP_ID` from `@senryo/config` — never duplicated here.
 */
// The selected network lives in `~/lib/network` (S8.22): `useNetwork()` in React, `activeNetwork()` elsewhere.

/** The session chip re-renders once a second while unlocked. */
export const CHIP_TICK_MS = 1_000;
/** Measurement ring buffer kept on the device for the S6 per-authenticator report. */
export const MEASURE_MAX_EVENTS = 200;
/** Starter relay polling (S3 `GET /v1/starter/relays/:id` until finalized / reverted / abandoned). */
export const RELAY_POLL_MS = 600;
export const RELAY_POLL_MAX = 60;
/** The recovery phrase hides again after this long, and at once when the app leaves the foreground. */
export const PHRASE_VISIBLE_MS = 60_000;
/** Random bytes behind the per-install device id. */
export const DEVICE_ID_BYTES = 16;
/** "Copied" confirmation lifetime on inline copy actions. */
export const COPIED_MS = 1_500;
