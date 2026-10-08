/**
 * Platform seams. `@senryo/account/{passkey,secret-store,sync}` resolve per platform through package `exports`
 * conditions (`react-native` → `*.native.ts`, `default` → `*.web.ts`); the core code only sees these interfaces.
 */
import type { PasskeyCredentialMetadata, PasskeySecretVault, WebAuthnClient } from "@category-labs/mera";
import type { Address } from "viem";

export type PlatformKind = "web" | "native";

export interface PasskeyPlatform {
  readonly kind: PlatformKind;
  /** `undefined` → Mera's built-in browser client (`navigator.credentials`). */
  readonly webAuthnClient: WebAuthnClient | undefined;
}

/**
 * The non-secret hint that lets a returning user see their portfolio without a prompt. Safe to lose: a discoverable
 * ceremony rebuilds everything (Mera stateless test).
 */
export interface AccountHint {
  address: Address;
  credential: PasskeyCredentialMetadata;
  /** `passkey`: the credential's PRF is the root. `vault`: that passkey decrypts the root phrase (recovery). */
  mode: "passkey" | "vault";
  /** Present in vault mode: AES-GCM ciphertext, safe on untrusted storage (Mera `PasskeySecretVault`). */
  vault?: PasskeySecretVault;
  savedAt: number;
}

export type UnlockRead =
  | { status: "ok"; credentialId: string; prfOutput: Uint8Array }
  | { status: "absent" }
  /** The OS dropped the biometric-gated item (Face ID / fingerprints changed): run a passkey ceremony again. */
  | { status: "invalidated" };

export interface SecretStore {
  readonly kind: PlatformKind;
  readHint(): Promise<AccountHint | undefined>;
  writeHint(hint: AccountHint): Promise<void>;
  /** Native: the device can hold a biometric-gated item. Web: always false — the PRF output is never persisted. */
  canPersistUnlock(): Promise<boolean>;
  /** Native only: the PRF output behind the OS biometric gate (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`). */
  storeUnlock(credentialId: string, prfOutput: Uint8Array): Promise<void>;
  /** Native only: shows the OS biometric sheet with `prompt` (no passkey sheet). */
  readUnlock(prompt: string): Promise<UnlockRead>;
  /** Sign out: removes the hint and the gated item. */
  clear(): Promise<void>;
}

export type LockReason = "ttl" | "idle" | "background" | "manual" | "other-tab" | "signed-out" | "invalidated";

export type SyncEvent =
  | { type: "unlocked"; address: Address; tab: string }
  | { type: "locked"; reason: LockReason; tab: string }
  | { type: "signed-out"; tab: string };

/** Cross-tab session sync (web BroadcastChannel); a no-op on native (one process, one session). */
export interface SessionSync {
  readonly tab: string;
  publish(event: SyncEvent): void;
  subscribe(listener: (event: SyncEvent) => void): () => void;
  close(): void;
}

/** Where the one-tap delegate key lives (`delegate-store.native.ts` / `.web.ts`, D-280). */
export interface DelegateStore {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}
