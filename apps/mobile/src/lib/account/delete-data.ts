/**
 * "Delete my data" on this phone (A9, defect 10): what the phone keeps about an account, and the server part that is
 * owed when Senryo couldn't be reached. Display choices (theme, sounds, haptics, chart style, mode, hidden balances)
 * hold nothing about the person and stay. Operation records still in flight stay too: an unknown outcome is never
 * forgotten (money truth); finished ones go.
 */
import type { Address } from "@senryo/account";
import { measureStore } from "~/lib/account/measure";
import { PENDING_LINK } from "~/lib/incoming-link";
import { STORAGE_KEYS, storage } from "~/lib/storage";

/** Everything on this phone that is about the person or their account. */
const ACCOUNT_KEYS = [
  STORAGE_KEYS.sessionSettings,
  STORAGE_KEYS.device,
  STORAGE_KEYS.welcomed,
  STORAGE_KEYS.setup,
  STORAGE_KEYS.setupCreating,
  STORAGE_KEYS.termsAccepted,
  STORAGE_KEYS.riskExplained,
  STORAGE_KEYS.eligibilityAccepted,
  STORAGE_KEYS.cardIntroSeen,
  STORAGE_KEYS.markets,
  STORAGE_KEYS.watchlistAt,
  STORAGE_KEYS.push,
  STORAGE_KEYS.identityCache,
  STORAGE_KEYS.lastAccount,
  PENDING_LINK,
] as const;
/** Stored once per network or account (`key:…`), so they are found by prefix. */
const ACCOUNT_KEY_PREFIXES = [
  STORAGE_KEYS.liquidationSeen,
  STORAGE_KEYS.liquidationDismissed,
  "senryo.welcome-complete:",
] as const;
const OPERATION_PREFIX = "senryo.operation.v1:";
const IN_FLIGHT = ["preparing", "pending"];

/** A finished operation record of this account (records are stored under their key and under their id). */
function finishedOperationOf(raw: string | undefined, lower: string): boolean {
  if (!raw) return false;
  try {
    const record = JSON.parse(raw) as { outcome?: string; account?: string };
    return record.account?.toLowerCase() === lower && !IN_FLIGHT.includes(record.outcome ?? "");
  } catch {
    return false;
  }
}

/** Clears the phone's part. Runs after sign-out, which already removed the hint and the Face ID unlock item. */
export function clearPhone(address: Address | undefined) {
  for (const key of ACCOUNT_KEYS) storage.remove(key);
  const lower = address?.toLowerCase();
  for (const key of storage.getAllKeys()) {
    if (ACCOUNT_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) storage.remove(key);
    else if (lower && key.startsWith(OPERATION_PREFIX) && finishedOperationOf(storage.getString(key), lower))
      storage.remove(key);
  }
  measureStore.clear();
}

function pending(): string[] {
  const raw = storage.getString(STORAGE_KEYS.pendingDelete);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

/** The server part didn't reach Senryo: owe it, retried at that account's next unlock on this phone. */
export function oweServerDelete(address: Address) {
  const lower = address.toLowerCase();
  if (!pending().includes(lower)) storage.set(STORAGE_KEYS.pendingDelete, JSON.stringify([...pending(), lower]));
}

export function serverDeleteOwed(address: Address | undefined): boolean {
  return address !== undefined && pending().includes(address.toLowerCase());
}

export function serverDeleteDone(address: Address) {
  const rest = pending().filter((a) => a !== address.toLowerCase());
  if (rest.length) storage.set(STORAGE_KEYS.pendingDelete, JSON.stringify(rest));
  else storage.remove(STORAGE_KEYS.pendingDelete);
}
