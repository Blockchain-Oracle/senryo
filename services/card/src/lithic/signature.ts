import { createHmac, timingSafeEqual } from "node:crypto";
import { MS_PER_SECOND } from "@senryo/service-common";

/**
 * Lithic webhook / ASA signatures (docs.lithic.com events-api; the same scheme signs ASA requests once the ASA HMAC
 * secret is retrieved): Standard Webhooks —
 *   signed  = `${webhook-id}.${webhook-timestamp}.${rawBody}`
 *   key     = base64-decode(secret without the `whsec_` prefix)
 *   header  = space-separated `v1,<base64 HMAC-SHA256>` entries (any one may match)
 * Reject timestamps outside ±tolerance. Constant-time comparison. The raw body bytes are what was signed — never a
 * re-serialised JSON.
 */

const SECRET_PREFIX = "whsec_";
const VERSION = "v1";

export interface SignatureHeaders {
  id: string | undefined;
  timestamp: string | undefined;
  signature: string | undefined;
}

export type SignatureCheck =
  | { ok: true }
  | { ok: false; reason: "missing-headers" | "bad-timestamp" | "stale" | "mismatch" | "bad-secret" };

export function secretKey(secret: string): Buffer {
  const body = secret.startsWith(SECRET_PREFIX) ? secret.slice(SECRET_PREFIX.length) : secret;
  return Buffer.from(body, "base64");
}

export function sign(key: Buffer, id: string, timestamp: string, rawBody: Buffer | string): string {
  return createHmac("sha256", key).update(`${id}.${timestamp}.`).update(rawBody).digest("base64");
}

export function verifySignature(
  secret: string,
  headers: SignatureHeaders,
  rawBody: Buffer,
  toleranceSec: number,
  nowSec: number = Math.floor(Date.now() / MS_PER_SECOND),
): SignatureCheck {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return { ok: false, reason: "missing-headers" };
  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return { ok: false, reason: "bad-timestamp" };
  if (Math.abs(nowSec - ts) > toleranceSec) return { ok: false, reason: "stale" };
  const key = secretKey(secret);
  if (key.length === 0) return { ok: false, reason: "bad-secret" };
  const expected = Buffer.from(sign(key, id, timestamp, rawBody), "base64");
  for (const entry of signature.split(" ")) {
    const [version, value] = entry.split(",");
    if (version !== VERSION || !value) continue;
    const candidate = Buffer.from(value, "base64");
    if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) return { ok: true };
  }
  return { ok: false, reason: "mismatch" };
}

/** Header names (lower-case, as Node exposes them). */
export const SIGNATURE_HEADERS = {
  id: "webhook-id",
  timestamp: "webhook-timestamp",
  signature: "webhook-signature",
} as const;

/** Test/drive helper: build the three headers for a body with a local secret. */
export function signedHeaders(secret: string, id: string, rawBody: string, nowSec: number): Record<string, string> {
  const timestamp = String(nowSec);
  return {
    [SIGNATURE_HEADERS.id]: id,
    [SIGNATURE_HEADERS.timestamp]: timestamp,
    [SIGNATURE_HEADERS.signature]: `${VERSION},${sign(secretKey(secret), id, timestamp, rawBody)}`,
  };
}
