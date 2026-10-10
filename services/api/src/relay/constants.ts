/** The relay's numbers (D-266, D-278). */

/** A signed call must be used within this long (the app signs a fresh one per tap). */
export const MAX_INTENT_TTL_SEC = 120;
/** How long a commit waits for its window's open print to be provable before giving up. */
export const OPEN_PRINT_WAIT_MS = 4_000;
/** Calls per address per minute (one tap is one call; a burst beyond this is a bug or abuse). */
export const CALLS_PER_MINUTE = 30;
export const RATE_WINDOW_MS = 60_000;
/** Practice dollars: the grant at sign-up, then at most one top-up a day back to this balance (6 decimals). */
export const PRACTICE_GRANT = 1_000_000_000n;
export const PRACTICE_TOPUP_EVERY_MS = 86_400_000;
/** Most of an owner's tickets returned at once. */
export const TICKETS_PAGE = 100;
/** One Monad block: how far before a second's end the relay may already use a print published in it. */
export const CHAIN_CLOCK_SLACK_MS = 300;
/** A simulation refused only because the chain's clock trails the print is retried this often, this far apart. */
export const FUTURE_PRINT_RETRIES = 4;
export const FUTURE_PRINT_RETRY_MS = 300;
/** Exits (D-292): how often the watcher prices every armed exit, and reloads them from the ticket book. */
export const EXIT_TICK_MS = 1_000;
export const EXIT_RELOAD_MS = 2_000;
/** The chain is re-read for exits set by anyone (not only through this relay) this often. */
export const EXIT_CHAIN_SYNC_MS = 30_000;
/** After a fire, the exit waits this long before it may fire again (a miss leaves it standing). */
export const EXIT_RETRY_MS = 3_000;
