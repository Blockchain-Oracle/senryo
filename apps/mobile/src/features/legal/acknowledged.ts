/** Which version of the terms each account has acknowledged, on this device (J1 terms step; C12). */
import type { Address } from "@senryo/account";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { LEGAL_VERSION } from "./content";

type Stored = Record<string, string>;

function read(): Stored {
  const raw = storage.getString(STORAGE_KEYS.termsAccepted);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Stored;
  } catch {
    return {};
  }
}

export function hasAcknowledgedTerms(address: Address | undefined): boolean {
  return address !== undefined && read()[address.toLowerCase()] === LEGAL_VERSION;
}

export function acknowledgeTerms(address: Address) {
  storage.set(STORAGE_KEYS.termsAccepted, JSON.stringify({ ...read(), [address.toLowerCase()]: LEGAL_VERSION }));
}
