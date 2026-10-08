/** Keeper defaults (all overridable by env). Contract-mirrored values cite contracts/src/libraries/Constants.sol. */

export const KEEPER_PORT = 3002;

/** `/health` fails when the scheduler has not ticked for this long (specs/services.md keeper). */
export const KEEPER_STALE_SEC = 120;

export const INTERVALS_MS = {
  retention: 86_400_000,
  receipts: 900_000,
  /** Queued notifications from the api and keeper wait at most this long for their push. */
  pushes: 3_000,
} as const;

/** Markets (D-278): settle a window this long after its expiry (its close print streams within a second). */
export const SETTLE_AFTER_SEC = 2;
export const SETTLE_INTERVAL_MS = 2_000;
/** A fill the relay has not done this long after its print instant is done here. */
export const FILL_STALE_SEC = 6;
export const FILLS_INTERVAL_MS = 3_000;
/** The book follows the chain: new ticket ids and quiet open tickets re-read every few seconds, in batches. */
export const SYNC_INTERVAL_MS = 4_000;
export const SYNC_STALE_SEC = 20;
export const SYNC_BATCH = 64;

/** Retention windows in days (S8.5b K9). */
export const RETENTION_DAYS = {
  siweNonces: 1,
  latency: 30,
  events: 90,
  pushSends: 30,
  /** Checked Expo push tickets (deleted by the `receipts` job, not the daily sweep). */
  pushTickets: 7,
} as const;

/** Receipts are fetched this long after the send (Expo's recommendation) and are gone after Expo clears them (24 h). */
export const PUSH_RECEIPT_DELAY_SEC = 900;
export const PUSH_RECEIPT_TTL_SEC = 86_400;
/** Tickets checked per `receipts` run (the rest wait for the next run). */
export const PUSH_RECEIPTS_PER_RUN = 10_000;
