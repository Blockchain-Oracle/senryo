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
