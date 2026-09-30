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
