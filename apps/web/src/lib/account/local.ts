/**
 * Safe localStorage access for non-secret app state (settings, measurement log, device id). Privacy modes can throw
 * on access; every reader treats "missing" as the normal path (stateless test).
 */
import { AUTH_STORAGE, DEVICE_ID_BYTES } from "@/lib/constants/auth";

const HEX_RADIX = 16;
const HEX_PER_BYTE = 2;

function store(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export function readJson<T>(key: string, parse: (raw: unknown) => T | undefined): T | undefined {
  try {
    const raw = store()?.getItem(key);
    return raw ? parse(JSON.parse(raw)) : undefined;
  } catch {
    return undefined;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    store()?.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or privacy mode: non-secret conveniences only, safe to drop.
  }
}

export function removeKey(key: string): void {
  try {
    store()?.removeItem(key);
  } catch {}
}

/** A random per-install id for the relay's rate limit (`x-senryo-device`). Not an identity; cleared with site data. */
export function deviceId(): string {
  const existing = readJson(AUTH_STORAGE.device, (v) => (typeof v === "string" ? v : undefined));
  if (existing) return existing;
  const bytes = new Uint8Array(DEVICE_ID_BYTES);
  crypto.getRandomValues(bytes);
  const id = Array.from(bytes, (b) => b.toString(HEX_RADIX).padStart(HEX_PER_BYTE, "0")).join("");
  writeJson(AUTH_STORAGE.device, id);
  return id;
}
