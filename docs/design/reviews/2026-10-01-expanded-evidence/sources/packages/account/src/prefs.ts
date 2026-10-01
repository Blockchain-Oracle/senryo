/**
 * Encrypted preferences (D-040 untrusted storage, F08 "encrypted prefs restored"): the server (`/v1/prefs`) keeps an
 * opaque base64url blob = AES-256-GCM(prefsKey, JSON) with a random 12-byte nonce prepended (@noble/ciphers
 * `managedNonce(gcm)`, pure JS — the same code on web and Hermes). Tampering fails authentication → treated as absent.
 * Only non-secret settings go in; the key never leaves `@senryo/account`.
 */
import { gcm } from "@noble/ciphers/aes.js";
import { managedNonce } from "@noble/ciphers/utils.js";
import { base64urlnopad } from "@scure/base";
import type { FaceIdMode } from "./policy/types.ts";

export const PREFS_VERSION = 1;

export interface Prefs {
  v: typeof PREFS_VERSION;
  /** Security → session length / idle lock / Face ID per trade (restored on a new device). */
  session?: { ttlMs: number; idleMs: number; faceId?: FaceIdMode | undefined };
}

export function sealPrefs(key: Uint8Array, prefs: Prefs): string {
  const plaintext = new TextEncoder().encode(JSON.stringify(prefs));
  return base64urlnopad.encode(managedNonce(gcm)(key).encrypt(plaintext));
}

/** `undefined` for a blob that doesn't authenticate (another account, tampering) or isn't our shape. */
export function openPrefs(key: Uint8Array, blob: string): Prefs | undefined {
  try {
    const json = JSON.parse(new TextDecoder().decode(managedNonce(gcm)(key).decrypt(base64urlnopad.decode(blob))));
    return json && typeof json === "object" && json.v === PREFS_VERSION ? (json as Prefs) : undefined;
  } catch {
    return undefined;
  }
}
