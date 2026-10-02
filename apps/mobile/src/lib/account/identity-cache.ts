/**
 * What this phone remembers about the accounts it has opened (A3): each account's @handle and avatar as last seen,
 * so the returning Welcome can name the account before (or without) the network, and the last account that was
 * signed in here, kept after sign-out, so a passkey that opens a different, empty account can be warned about. Nothing
 * secret: a handle and an avatar id are public wherever the profile is listed. "Delete my data" removes both.
 */
import type { Address } from "@senryo/account";
import { STORAGE_KEYS, storage } from "~/lib/storage";

export interface CachedIdentity {
  handle: string | null;
  avatar: string | null;
}

type Stored = Record<string, CachedIdentity>;

function read(): Stored {
  const raw = storage.getString(STORAGE_KEYS.identityCache);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Stored;
  } catch {
    return {};
  }
}

export function cachedIdentity(address: Address | undefined): CachedIdentity | undefined {
  return address ? read()[address.toLowerCase()] : undefined;
}

export function cacheIdentity(address: Address, identity: CachedIdentity) {
  const key = address.toLowerCase();
  const was = read()[key];
  if (was && was.handle === identity.handle && was.avatar === identity.avatar) return;
  storage.set(STORAGE_KEYS.identityCache, JSON.stringify({ ...read(), [key]: identity }));
}

/** The account this phone last had signed in (it survives sign-out). */
export function lastAccount(): Address | undefined {
  const raw = storage.getString(STORAGE_KEYS.lastAccount);
  return raw ? (raw as Address) : undefined;
}

export function rememberAccount(address: Address) {
  storage.set(STORAGE_KEYS.lastAccount, address);
}
