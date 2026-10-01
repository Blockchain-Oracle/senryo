/**
 * S12b social constants (D-174, v2-plan W5/§5.9): reserved names, the blocked-word list and route limits.
 * Lists are lower-case ASCII; matching runs on a folded form (see moderation.ts). The blocked-word list is a starter
 * for handles, names and bios — S12b.6's post filter extends it.
 */

/** Exact handles Senryo keeps: the product, partners and venues shown in the app, roles and app routes. */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  // Senryo and the brands the app shows (v2-plan §5.12).
  "senryo",
  "kinpaku",
  "monad",
  "monadxyz",
  "mera",
  "agora",
  "ausd",
  "perpl",
  "aurora",
  "chainlink",
  "envio",
  "lithic",
  "immersve",
  "circle",
  "usdc",
  "tether",
  "uniswap",
  "pyth",
  "phantom",
  "fomo",
  "hyperliquid",
  "apple",
  "google",
  "metamask",
  "coinbase",
  "binance",
  // Roles and system words.
  "admin",
  "administrator",
  "root",
  "system",
  "support",
  "help",
  "helpdesk",
  "team",
  "staff",
  "moderator",
  "mods",
  "official",
  "security",
  "owner",
  "founder",
  "everyone",
  "here",
  "null",
  "undefined",
  "anonymous",
  "deleted",
  "unknown",
  "verified",
  "verify",
  "info",
  "contact",
  "press",
  "legal",
  "privacy",
  "terms",
  "status",
  "docs",
  "blog",
  "news",
  // App surfaces a handle must never shadow.
  "account",
  "accounts",
  "wallet",
  "settings",
  "profile",
  "login",
  "logout",
  "signin",
  "signup",
  "search",
  "explore",
  "markets",
  "market",
  "trade",
  "trades",
  "feed",
  "leaderboard",
  "people",
  "friends",
  "card",
  "cards",
  "notifications",
  "rewards",
  "referral",
]);

/** Tokens no handle may contain anywhere: staff and brand impersonation (`senryo_support`, `official_admin`). */
export const RESERVED_HANDLE_TOKENS = ["senryo", "kinpaku", "official", "support", "admin", "moderator"] as const;
/** Tokens a display name may not use as a word ("Senryo Support"); ordinary words like "support" stay allowed. */
export const RESERVED_NAME_TOKENS = ["senryo", "kinpaku", "official"] as const;

/**
 * Blocked words (slurs, sexual, extremist). Roots are chosen to avoid innocent substrings (no "ass", "rape", "cock",
 * "spic": class, grape, peacock, spice). Handles match anywhere in the folded string; text matches word prefixes.
 */
export const BLOCKED_WORDS = [
  "fuck",
  "shit",
  "cunt",
  "twat",
  "bitch",
  "whore",
  "slut",
  "nigger",
  "nigga",
  "faggot",
  "fagot",
  "retard",
  "tranny",
  "kike",
  "chink",
  "gook",
  "wetback",
  "nazi",
  "hitler",
  "kkk",
  "porn",
  "jizz",
  "dildo",
  "pedophile",
  "paedophile",
  "pedofile",
  "molest",
] as const;

/** Leetspeak folding applied before matching (`n1gg3r` → `nigger`). */
export const LEET_FOLD: Readonly<Record<string, string>> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  $: "s",
  "!": "i",
};

/** Handle changes (each tombstones the previous handle) per account within one tombstone window. */
export const HANDLE_CHANGES_PER_WINDOW = 5;

/** Route rate limits per IP (`@fastify/rate-limit`, global: false). */
export const HANDLE_CHECK_RATE = { max: 60, timeWindow: "1 minute" } as const;
export const PROFILE_READ_RATE = { max: 120, timeWindow: "1 minute" } as const;
export const PROFILE_WRITE_RATE = { max: 10, timeWindow: "1 minute" } as const;
export const FOLLOW_READ_RATE = { max: 120, timeWindow: "1 minute" } as const;
export const FOLLOW_WRITE_RATE = { max: 60, timeWindow: "1 minute" } as const;

/** Postgres SQLSTATEs the social routes map to client errors. */
export const PG_UNIQUE_VIOLATION = "23505";
export const PG_DEADLOCK_DETECTED = "40P01";
/** The case-insensitive handle index (migration 0005). */
export const HANDLE_UNIQUE_INDEX = "profiles_handle_key";

/** Advisory-lock namespaces (`pg_advisory_xact_lock(hashtextextended(ns || key, 0))`). */
export const LOCK_NS = { profile: "senryo.profile:", handle: "senryo.handle:", follow: "senryo.follow:" } as const;
