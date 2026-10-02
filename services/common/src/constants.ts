/** Shared numeric constants for the service runtime (the per-module constants home, CLAUDE.md). */

export const HTTP_STATUS = {
  ok: 200,
  created: 201,
  accepted: 202,
  noContent: 204,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  gone: 410,
  tooLarge: 413,
  tooMany: 429,
  internal: 500,
  badGateway: 502,
  unavailable: 503,
} as const;

/** Default JSON body limit (256 KiB); routes with blobs set their own. */
export const DEFAULT_BODY_LIMIT_BYTES = 256 * 1024;

export const MS_PER_SECOND = 1_000;
export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 3_600;
export const SECONDS_PER_DAY = 86_400;

/**
 * Expo Push Service (docs.expo.dev/push-notifications/sending-notifications, read 2026-10-01): at most 100 messages
 * per send and 1,000 ids per getReceipts request (PUSH_TOO_MANY_NOTIFICATIONS / PUSH_TOO_MANY_RECEIPTS otherwise).
 */
export const EXPO_PUSH = {
  sendUrl: "https://exp.host/--/api/v2/push/send",
  receiptsUrl: "https://exp.host/--/api/v2/push/getReceipts",
  sendBatch: 100,
  receiptsBatch: 1_000,
  timeoutMs: 10_000,
} as const;

/**
 * Push delivery from the `push_sends` outbox (G1, D7): one retry after a failed attempt, never a push older than
 * `freshSec` (a backlog after an outage or a delivery switch-on is closed, not sent), `batch` rows per claim.
 */
export const PUSH_DELIVERY = {
  maxAttempts: 2,
  retryDelaySec: 30,
  freshSec: 600,
  batch: 50,
} as const;
