/**
 * Mobile auth constants (S6). The rpId is `RP_ID` from `@senryo/config` — never duplicated here.
 */
import { TESTNET } from "@senryo/config";

/** Practice (testnet) is the only live network until the mainnet deploy (S8); Account → Mode says so. */
export const ACTIVE_NETWORK = TESTNET;

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
/** The brand intro holds this long before the value pages (skipped under Reduce Motion; tap to skip). */
export const INTRO_HOLD_MS = 1_200;
/** "Copied" confirmation lifetime on inline copy actions. */
export const COPIED_MS = 1_500;
