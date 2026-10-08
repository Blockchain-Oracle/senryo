import { createHmac, timingSafeEqual } from "node:crypto";
import type { Address } from "@senryo/chain";
import { STREAM_TICKET_TTL_SEC } from "./constants.ts";

/**
 * `user:<address>` topics need a short-lived HMAC ticket minted from a signed-in session (CWF `stream-ticket`):
 * `<address>.<expiry>.<hmac>`. Only the address's own events (fills, results, payouts) are behind it.
 */
const SEP = ".";
const HEX = "hex";

function mac(secret: string, address: string, expiry: number): string {
  return createHmac("sha256", secret).update(`stream:${address.toLowerCase()}:${expiry}`).digest(HEX);
}

export function mintStreamTicket(
  secret: string,
  address: Address,
  nowSec: number,
): { ticket: string; expiresAt: number } {
  const expiresAt = nowSec + STREAM_TICKET_TTL_SEC;
  return { ticket: [address.toLowerCase(), expiresAt, mac(secret, address, expiresAt)].join(SEP), expiresAt };
}

/** The ticket's address, or null when it is malformed, forged or expired. */
export function verifyStreamTicket(secret: string, ticket: string, nowSec: number): string | null {
  const [address, expiry, given] = ticket.split(SEP);
  if (!address || !expiry || !given) return null;
  const exp = Number(expiry);
  if (!Number.isInteger(exp) || exp < nowSec) return null;
  const want = Buffer.from(mac(secret, address, exp), HEX);
  const got = Buffer.from(given, HEX);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  return address.toLowerCase();
}
