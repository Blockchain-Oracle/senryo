import * as z from "zod";

/**
 * Every non-2xx response body: `{ error: { code, message, retryAfterSec?, details? } }`.
 * `code` is stable (clients map it to copy, flows.md); `message` is technical and never shown as-is.
 */
export const API_ERROR_CODES = [
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "PAYLOAD_TOO_LARGE",
  "RATE_LIMITED",
  "GEO_BLOCKED",
  "NOT_DEPLOYED",
  "SIGNATURE_INVALID",
  "SIGNATURE_EXPIRED",
  // Practice dollars and the relay (S3): one grant per account, session budgets, the sponsor's lanes.
  "ALREADY_CLAIMED",
  "BUDGET_EXHAUSTED",
  "RELAYER_BUSY",
  "RELAY_REVERTED",
  "UPSTREAM_UNAVAILABLE",
  // A market with no price source (D-310): listed for discovery, no calls.
  "MARKET_PAUSED",
  // A market whose price is stale or too wide while open (D-289): no new calls until it steadies.
  "MARKET_HALTED",
  // Handles and profile text.
  "HANDLE_INVALID",
  "HANDLE_RESERVED",
  "HANDLE_TAKEN",
  "HANDLE_HELD",
  "CONTENT_BLOCKED",
  "INTERNAL",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.enum(API_ERROR_CODES),
    message: z.string(),
    retryAfterSec: z.int().nonnegative().optional(),
    details: z.unknown().optional(),
  }),
});

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

/** Thrown by the fetch client for any non-2xx (or unparseable) response. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly retryAfterSec: number | undefined;
  readonly details: unknown;

  constructor(status: number, body: ApiErrorBody["error"]) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.retryAfterSec = body.retryAfterSec;
    this.details = body.details;
  }
}
