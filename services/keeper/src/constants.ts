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
export const FILL_STALE_SEC = 10;
export const FILLS_INTERVAL_MS = 3_000;
/** Parlays: backup fills and the legs' verdicts (S8.5). */
export const PARLAYS_INTERVAL_MS = 2_000;
/** Duels (S8.6): refunds, locks, card settlement and pots; matches looked at per tick; a pairing left `opening`. */
export const DUELS_INTERVAL_MS = 3_000;
export const DUEL_WORK_BATCH = 16;
export const DUEL_OPENING_STALE_SEC = 120;
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
/** Market calendars (D-289): checked every 15 minutes; holidays kept 60 days ahead (≤ 32 per calendar on chain). */
export const CALENDARS_INTERVAL_MS = 900_000;
export const CALENDAR_HOLIDAY_DAYS = 60;
/** Earn (D-287): the hourly roll is tried every minute after the hour until the hour's windows are settled. */
export const EARN_INTERVAL_MS = 60_000;
export const HOUR_SEC = 3600;
/** Owners delivered per tick (each delivery is one `claim`). */
export const EARN_CLAIMS_PER_TICK = 20;
/** Events (S8.7, D-296): answers, verdicts and payouts every 30 s; new games listed every 10 minutes. */
export const EVENTS_INTERVAL_MS = 30_000;
export const EVENTS_LIST_EVERY_MS = 600_000;
/** A game is listed only while calls have at least this long to run. */
export const EVENT_MIN_LEAD_SEC = 900;
/** Listings per transaction (each carries its question and rules as text). */
export const EVENT_LIST_BATCH = 8;
/** Events looked at per tick, answers relayed per batch, calls paid per `claimFor` (the book's `MAX_BATCH`). */
export const EVENT_WORK_BATCH = 24;
export const EVENT_ANSWER_BATCH = 24;
export const EVENT_CLAIM_BATCH = 32;
/** A listing row whose transaction hasn't landed after this is checked against the chain. */
export const EVENT_LISTING_STALE_SEC = 300;
/** Every source read gives up after this. */
export const EVENT_SOURCE_TIMEOUT_MS = 10_000;
/** Two sources' starts for one game may differ by this much (a feed rounding, a late correction). */
export const EVENT_START_SLACK_SEC = 1800;
/** Committee signers: `EVENT_SIGNER_1_PK` … in committee order. */
export const EVENT_SIGNER_PREFIX = "EVENT_SIGNER";
export const EVENT_SIGNERS_MAX = 16;
