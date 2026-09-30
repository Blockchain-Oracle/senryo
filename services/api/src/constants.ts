/** services/api constants (specs/services.md §api; D-023/D-038 geo; D-030 starter limits). */

export const API_PORT = 3000;

export const MIN_APP_VERSION = "0.1.0";

/**
 * CORS methods for the web app (S6.12, D-154): `@fastify/cors` defaults to the safelisted GET/HEAD/POST, which makes
 * the browser drop `PUT /v1/prefs`, `PUT /v1/vault` and the DELETEs after their preflight.
 */
export const CORS_METHODS = ["GET", "HEAD", "POST", "PUT", "DELETE"] as const;

/**
 * D-023/D-038: mainnet new risk is gated for Perpl's blocked list plus comprehensively sanctioned jurisdictions.
 * Practice (testnet) is never gated; deposits/withdrawals of the user's own funds are never gated.
 */
export const PERPL_BLOCKED = ["BY", "CU", "GB", "IR", "KP", "RU", "SY", "UA", "US"] as const;
export const SANCTIONED = ["CU", "IR", "KP", "SY"] as const;

/** Edge headers that may carry the viewer country (first match wins). */
export const COUNTRY_HEADERS = ["cf-ipcountry", "x-vercel-ip-country", "x-geo-country"] as const;

/** Starter relay rate limits (per UTC day): one claim per device, a few per IPv4 /24 (or IPv6 /48). */
export const STARTER_PER_DEVICE_PER_DAY = 1;
export const STARTER_PER_NETWORK_PER_DAY = 5;
export const IPV4_PREFIX_OCTETS = 3;
export const IPV6_PREFIX_GROUPS = 3;

/** Prices channel poll (oracle `peek`) and account channel refresh. */
export const PRICE_POLL_MS = 1_000;
export const ACCOUNT_POLL_MS = 1_000;
export const INDEXER_POLL_MS = 500;
/** Activity rows returned with /v1/account (full pages come from @senryo/indexer-client in the apps). */
export const RECENT_ACTIVITY = 20;
export const WS_MAX_SUBSCRIPTIONS = 16;
export const WS_MAX_PAYLOAD_BYTES = 16 * 1024;
/** Drop intermediate ticks for a socket with this much unsent data. */
export const WS_BACKPRESSURE_BYTES = 64 * 1024;
/** Upstream error text kept in /v1/status. */
export const ERROR_DETAIL_MAX_CHARS = 120;

/** Body limit for routes carrying encrypted blobs (prefs ≤ 64 KiB base64url + envelope). */
export const BLOB_BODY_LIMIT_BYTES = 96 * 1024;

export const CLOUDFLARE_TURNSTILE_VERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const UPSTREAM_TIMEOUT_MS = 3_000;
