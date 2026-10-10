/** The duel service's numbers (S8.6, D-294). */

/** Card windows, shortest first: 5-minute ones while they have room, 15-minute ones to fill the deck. */
export const DECK_CADENCES = [300, 900] as const;
/** Room beyond the arena's `minCardLifeSec` for the open and reveal transactions. */
export const DECK_MARGIN_SEC = 20;
export const SEED_BYTES = 32;
/** How often the matchmaker looks at the queue. */
export const MATCHMAKER_TICK_MS = 1_000;
/** Ratings (Elo, from the indexer): a waiting entry accepts this far at first, wider by the step every interval. */
export const RATING_BAND_START = 100;
export const RATING_BAND_STEP = 50;
export const RATING_BAND_STEP_SEC = 15;
export const RATING_BAND_MAX = 400;
export const DEFAULT_RATING = 1000;
/** Entries a player may have queued at once (one per tier is plenty). */
export const MAX_QUEUED_PER_OWNER = 1;
/** Entries and picks per address per minute. */
export const DUEL_REQUESTS_PER_MINUTE = 30;
/** Duels listed per player. */
export const DUELS_PAGE = 30;
/** How long the reveal waits for a card window's open print before failing the match to a refund. */
export const REVEAL_PRINT_WAIT_MS = 4_000;
