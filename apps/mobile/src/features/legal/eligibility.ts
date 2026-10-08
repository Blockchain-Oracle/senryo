/**
 * FT101 / M13 (Fomo F36 adapted; D-273): before an account's first Real call it confirms it is outside the regions
 * Real money is closed to — sanctioned jurisdictions plus the Real-money list. Practice is never gated, and
 * deposits and withdrawals of your own funds never are. This self-attestation sits beside the server's IP check
 * (`/v1/geo`), which stays the primary block. The wording is the lead's draft for the user's review, like the Terms.
 */
import type { Address } from "@senryo/account";
import { STORAGE_KEYS, storage } from "~/lib/storage";

/** Bump when the wording or the region list changes: every account confirms again. */
export const ELIGIBILITY_VERSION = "2026-10-08";

/**
 * D-273: the api's `REAL_MONEY_BLOCKED` (AU, BY, CA, GB, RU, US) plus `SANCTIONED` (CU, IR, KP, SY), named as people
 * read them. The server's IP check uses the same two lists.
 */
export const RESTRICTED_REGIONS = [
  "the United States",
  "the United Kingdom",
  "Canada",
  "Australia",
  "Belarus",
  "Russia",
  "Cuba",
  "Iran",
  "North Korea",
  "Syria",
] as const;

type Stored = Record<string, string>;

function read(): Stored {
  const raw = storage.getString(STORAGE_KEYS.eligibilityAccepted);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Stored;
  } catch {
    return {};
  }
}

export function hasConfirmedEligibility(address: Address | undefined): boolean {
  return address !== undefined && read()[address.toLowerCase()] === ELIGIBILITY_VERSION;
}

export function confirmEligibility(address: Address): void {
  storage.set(
    STORAGE_KEYS.eligibilityAccepted,
    JSON.stringify({ ...read(), [address.toLowerCase()]: ELIGIBILITY_VERSION }),
  );
}
