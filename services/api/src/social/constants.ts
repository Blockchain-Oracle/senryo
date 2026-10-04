/**
 * S12b social constants (D-174, v2-plan W5/§5.9): reserved names, the blocked-word list and route limits.
 * Lists are lower-case ASCII; matching runs on a folded form (see moderation.ts). The blocked-word list is a starter
 * for handles, names and bios — S12b.6's post filter extends it.
 */

import { MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "@senryo/config";

/** Social reads are available on both networks, independently of the deployed money engine. */
export const SOCIAL_CHAIN_IDS = [TESTNET_CHAIN_ID, MAINNET_CHAIN_ID] as const;

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
export const LOCK_NS = {
  profile: "senryo.profile:",
  handle: "senryo.handle:",
  follow: "senryo.follow:",
  post: "senryo.post:",
  relation: "senryo.relation:",
  moderation: "senryo.moderation:",
} as const;

// ---------------------------------------------------------------- S12b.4 feed poller

/** How often the api asks the indexer for new fills (the "New activity" latency floor). */
export const FEED_POLL_MS = 3_000;
/** Fills per indexer page, and pages per tick per network (a backlog drains over a few ticks). */
export const FEED_PAGE = 200;
export const FEED_PAGES_PER_TICK = 10;
/** A fresh database (no cursor) starts this far back — and never before a trader turned sharing on. */
export const FEED_BACKFILL_SEC = 604_800;
/** Up to this many sharing accounts the indexer filters by `user_id _in`; above it the poller filters in-process. */
export const FEED_FILTER_IN_MAX = 500;
/** `feed_cursors.source` for the indexed fill stream. */
export const FEED_SOURCE_FILL = "fill";
/** Fill kinds that open, close, liquidate or flip a position → feed kind `position`; the rest are `fill`. */
export const POSITION_CHANGE_KINDS: ReadonlySet<string> = new Set(["OPEN", "CLOSE", "LIQUIDATE", "INVERT"]);
/** WS "New activity" notices per network are conflated to at most one per this interval. */
export const FEED_NOTICE_MIN_MS = 2_000;

// ---------------------------------------------------------------- S12b.5 leaderboard

export const LEADERBOARD_REFRESH_MS = 60_000;
export const LEADERBOARD_DEFAULT_LIMIT = 50;
/** 24h is rolling over fills. */
export const ROLLING_WINDOW_SEC = 86_400;
/** UTC-day bucket periods, today included. */
export const WINDOW_DAYS = { "7d": 7, "30d": 30 } as const;
/**
 * Anti-farming floor (§5.9): the device id is client-supplied, so a rank needs real trading in the window — at least
 * this many trades AND this much notional (usd6). Below it the account is "Not ranked" and never a follow suggestion.
 */
export const LEADERBOARD_FLOOR = {
  "24h": { minTrades: 3, minNotionalUsd6: 100_000_000n },
  "7d": { minTrades: 5, minNotionalUsd6: 500_000_000n },
  "30d": { minTrades: 10, minNotionalUsd6: 1_000_000_000n },
  all: { minTrades: 10, minNotionalUsd6: 1_000_000_000n },
} as const;
/** Market symbols shown per leaderboard row, from this many latest positions per ranked trader. */
export const ASSET_CLUSTER_MAX = 3;
export const RECENT_POSITIONS_PER_USER = 20;
/** Indexer rows per page and addresses per `_in` list (keeps each request bounded). */
export const INDEXER_PAGE = 500;
export const INDEXER_IN_CHUNK = 500;
/** Social reads page more than the bridge's display reads, so they get a longer budget. */
export const SOCIAL_INDEXER_TIMEOUT_MS = 10_000;
/** Without public aggregates the day buckets are paged; the probe is retried this often. */
export const AGGREGATE_REPROBE_MS = 600_000;
/** Weeks start Monday 00:00 UTC; day 0 (1970-01-01) was a Thursday, 3 days after a Monday. */
export const EPOCH_DAY_AFTER_MONDAY = 3;
export const DAYS_PER_WEEK = 7;
/** Top Trades need a position of at least this much opened notional (usd6) and a positive result. */
export const TOP_TRADE_MIN_NOTIONAL_USD6 = 100_000_000n;
/** Fill kinds that add to a position (its opened notional). */
export const OPENING_FILL_KINDS: ReadonlySet<string> = new Set(["OPEN", "INCREASE", "INVERT"]);

// ---------------------------------------------------------------- FT098 market Holders

/** A market's sharing holders and its accepted price are read at most this often per (network, market). */
export const HOLDERS_CACHE_MS = 5_000;

// ---------------------------------------------------------------- S12b.6 posts and moderation

/** Theses + replies one account may write per rolling hour (spam budget; 429 with retry-after). */
export const POSTS_PER_HOUR = 30;
export const POST_BUDGET_WINDOW_SEC = 3_600;
/** Report weight: only reporters who claimed the starter or funded an account count. */
export const REPORT_WEIGHT_TRUSTED = 1;
export const REPORT_WEIGHT_UNTRUSTED = 0;
/** Weighted reports that put a target in the review queue (and let an admin "hide" take effect). */
export const REPORT_REVIEW_WEIGHT = 3;
/** Relay stages that mean a starter claim or voucher landed. */
export const LANDED_STAGES = ["proposed", "voted", "finalized"] as const;
export const TRUSTED_RELAY_KINDS = ["claim", "voucher"] as const;
/** Blocks and mutes one account may hold. */
export const BLOCKS_MAX = 5_000;
export const MUTES_MAX = 5_000;
export const RELATION_PAGE_DEFAULT = 100;
/** Reviewer previews are cut to this many characters. */
export const REVIEW_PREVIEW_CHARS = 120;
/** `API_ADMIN_SECRET` must be at least this long (same bar as the session secret). */
export const ADMIN_SECRET_MIN_BYTES = 32;

export const POST_WRITE_RATE = { max: 30, timeWindow: "1 minute" } as const;
export const SOCIAL_READ_RATE = { max: 120, timeWindow: "1 minute" } as const;
export const RELATION_WRITE_RATE = { max: 60, timeWindow: "1 minute" } as const;
export const REPORT_RATE = { max: 20, timeWindow: "1 minute" } as const;
export const SEARCH_RATE = { max: 60, timeWindow: "1 minute" } as const;
export const ADMIN_RATE = { max: 30, timeWindow: "1 minute" } as const;
export const DELETE_DATA_RATE = { max: 5, timeWindow: "1 minute" } as const;

// ---------------------------------------------------------------- G1 social notifications

/** A liked post or a reply is quoted in the notification up to this many characters. */
export const NOTIFY_EXCERPT_MAX_CHARS = 80;
/** "A trader you follow opened a position" only for fills this recent (a feed backfill notifies nobody). */
export const FOLLOWED_OPEN_FRESH_SEC = 600;
/** Fill kind that opens a position (the `followedTrades` notification). */
export const OPEN_FILL_KIND = "OPEN";
