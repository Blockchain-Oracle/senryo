/** services/api constants (specs/services.md §api; D-023/D-038 geo; D-030 starter limits). */

export const API_PORT = 3000;

export const MIN_APP_VERSION = "0.1.0";

/**
 * CORS methods for the web app (S6.12, D-154): `@fastify/cors` defaults to the safelisted GET/HEAD/POST, which makes
 * the browser drop `PUT /v1/prefs`, `PUT /v1/vault` and the DELETEs after their preflight.
 */
export const CORS_METHODS = ["GET", "HEAD", "POST", "PUT", "DELETE"] as const;

/**
 * Real-money calls (mainnet) are not offered where retail binary-style price predictions are restricted (US CFTC,
 * UK FCA ban, Canada, Australia ASIC) or under sanctions (D-273). Practice is never gated.
 */
export const REAL_MONEY_BLOCKED = ["AU", "BY", "CA", "GB", "RU", "US"] as const;
export const SANCTIONED = ["CU", "IR", "KP", "SY"] as const;

/** Edge headers that may carry the viewer country (first match wins). */
export const COUNTRY_HEADERS = ["cf-ipcountry", "x-vercel-ip-country", "x-geo-country"] as const;

/** DB-IP "IP to Country Lite" (CC BY 4.0), monthly file; `{month}` = YYYY-MM (S8.15). */
export const GEO_DB_URL = "https://download.db-ip.com/free/dbip-country-lite-{month}.mmdb.gz";
/** Weekly refresh picks up the new monthly file; the download is ~5 MB gzipped. */
export const GEO_DB_REFRESH_MS = 604_800_000;
export const GEO_DB_TIMEOUT_MS = 60_000;

/** How often the api re-reads which catalogue series are on chain (R1.24): a deploy opens its markets within this. */
export const LISTING_REFRESH_MS = 600_000;

/** Body limit for routes carrying encrypted blobs (prefs ≤ 64 KiB base64url + envelope). */
export const BLOB_BODY_LIMIT_BYTES = 96 * 1024;

export const UPSTREAM_TIMEOUT_MS = 3_000;

/** Analytics events (S8.5b #13): client clocks may be off, never by more than a day; props stay small. */
export const EVENT_CLOCK_SKEW_MS = 86_400_000;
export const EVENT_PROPS_MAX_CHARS = 2_048;
