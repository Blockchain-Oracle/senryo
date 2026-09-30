/**
 * Web auth constants (S6). The rpId itself is `RP_ID` from `@senryo/config` — never duplicated here.
 */
import { TESTNET } from "@senryo/config";

/** Practice (testnet) is the only live network until the mainnet deploy (S8); the Mode screen says so. */
export const ACTIVE_NETWORK = TESTNET;

export const AUTH_STORAGE = {
  settings: "senryo.session-settings.v1",
  measure: "senryo.measure.v1",
  device: "senryo.device.v1",
  vault: "senryo.recovery-vault.v1",
} as const;

/** The session chip re-renders once a second while unlocked. */
export const CHIP_TICK_MS = 1_000;
/** Measurement ring buffer (prompt counts, flow timings, TTFT) kept on this device for the S6 device report. */
export const MEASURE_MAX_EVENTS = 200;
/** Starter relay polling (S3 `GET /v1/starter/relays/:id` until finalized / reverted / abandoned). */
export const RELAY_POLL_MS = 600;
export const RELAY_POLL_MAX = 60;
/** Recovery phrase is hidden again after this long, and immediately when the tab is hidden. */
export const PHRASE_VISIBLE_MS = 60_000;
/** Random bytes behind the per-install device id (rate-limit header, not an identity). */
export const DEVICE_ID_BYTES = 16;

/** Where the "Use your phone" QR (F65) sends a desktop without a PRF-capable passkey provider. */
export const PHONE_HANDOFF_PATH = "/";
