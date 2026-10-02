/**
 * Social limits (S12b, D-174, v2-plan §5.9) shared by services/api (enforced) and the apps (pre-checked).
 * The reserved and blocked-word lists stay server-side; `GET /v1/handles/:h/available` is the authority.
 */

export const HANDLE_MIN_CHARS = 4;
export const HANDLE_MAX_CHARS = 20;
/** `[a-z0-9_]{4,20}` — stored lower-case, unique case-insensitively. */
export const HANDLE_PATTERN = new RegExp(`^[a-z0-9_]{${HANDLE_MIN_CHARS},${HANDLE_MAX_CHARS}}$`);
const HANDLE_CHARSET = /^[a-z0-9_]*$/;
/** Raw handle input before normalisation (a leading "@", spaces, capitals). */
export const HANDLE_INPUT_MAX_CHARS = 64;
/** A released handle is held for its previous owner this long. */
export const HANDLE_TOMBSTONE_DAYS = 30;

export const DISPLAY_NAME_MAX_CHARS = 32;
export const BIO_MAX_CHARS = 160;
export const POST_MAX_CHARS = 280;
/** Authored avatar set ids (e.g. `portrait-07`); the set itself ships with the apps. */
export const AVATAR_ID_PATTERN = /^[a-z0-9-]{1,32}$/;

/** Accounts one address may follow (bounds the Friends feed and leaderboard scopes). */
export const FOLLOWING_MAX = 1_000;
export const FOLLOW_PAGE_DEFAULT = 30;
export const FOLLOW_PAGE_MAX = 100;

/**
 * Per-network visibility on first save (each is an explicit choice on the handle step): practice listed and public,
 * mainnet off until the user opts in with the "Real money" copy. A network's public trades need its listing.
 */
export const PROFILE_VISIBILITY_DEFAULTS = {
  listedPractice: true,
  listedMainnet: false,
  publicTradesPractice: true,
  publicTradesMainnet: false,
} as const;

/** Indexer market ids (`ours-0` = our engine's XAU, `perpl-16` = a Perpl perp) — the ids posts and feed rows carry. */
export const MARKET_ID_PATTERN = /^(ours|perpl)-\d{1,10}$/;
/** Indexer position ids (`ours-0-0xabc…-123_4`, `perpl-16-7-123_4`). */
export const POSITION_ID_PATTERN = /^[a-z0-9_-]{3,120}$/i;
/** Keyset cursors are Postgres bigint ids; 18 digits always fit (no 500 on a garbage cursor). */
export const ID_CURSOR_PATTERN = /^\d{1,18}$/;

/** Feed (S12b.4): newest first, keyset on `feed_events.id`. */
export const FEED_PAGE_DEFAULT = 30;
export const FEED_PAGE_MAX = 100;
/** Thread replies per page (oldest first under the thesis). */
export const REPLIES_PAGE_DEFAULT = 50;

/**
 * Leaderboard (S12b.5, §5.9): realized PnL after fees, funding and borrow, per network. 24h is rolling over fills;
 * 7d / 30d are UTC-day buckets (today included); All is lifetime.
 */
export const LEADERBOARD_PERIODS = ["24h", "7d", "30d", "all"] as const;
export const LEADERBOARD_SCOPES = ["all", "following"] as const;
export const LEADERBOARD_PAGE_MAX = 100;
/** Addresses per standings read: a profile asks for one, a page of search results for up to this many. */
export const STANDINGS_MAX = 20;
/** Onboarding "Follow top traders" (30d ranked floor only; none preselected). */
export const RECOMMENDATIONS_MAX = 10;
export const TOP_TRADES_MAX = 10;
/** Market Holders (FT098): the largest positions shown; the rest is a count. */
export const MARKET_HOLDERS_MAX = 50;

/** Posts (S12b.6): theses and one-level replies; a reply's parent is always a thesis. */
export const POST_KINDS = ["thesis", "reply"] as const;
/** What a read can return: also `trade`, a feed trade row's post (F-D1), which is never written directly. */
export const POST_VIEW_KINDS = [...POST_KINDS, "trade"] as const;
/** Reasons a report can carry (App Store 1.2); `note` adds free text. */
export const REPORT_REASONS = [
  "spam",
  "scam",
  "harassment",
  "hate",
  "sexual",
  "violence",
  "impersonation",
  "other",
] as const;
export const REPORT_NOTE_MAX_CHARS = 280;
export const BLOCK_PAGE_MAX = 200;

/** Search (S12b.7). */
export const SEARCH_KINDS = ["markets", "tokens", "traders"] as const;
export const SEARCH_QUERY_MAX_CHARS = 64;
export const SEARCH_RESULTS_MAX = 20;

/** The visible contact point for user-generated content (App Store 1.2), also served by `/v1/config`. */
export const SUPPORT_EMAIL = "support@senryo.xyz";

/** `" @Abu_J "` → `"abu_j"`: what the server stores and compares. */
export function normalizeHandle(input: string): string {
  return input.trim().replace(/^@/, "").toLowerCase();
}

export type HandleSyntaxIssue = "length" | "charset";

/** Syntax only (the client pre-check); `null` means the shape is fine — lists and ownership are the server's call. */
export function handleSyntaxIssue(normalized: string): HandleSyntaxIssue | null {
  if (!HANDLE_CHARSET.test(normalized)) return "charset";
  if (normalized.length < HANDLE_MIN_CHARS || normalized.length > HANDLE_MAX_CHARS) return "length";
  return null;
}
