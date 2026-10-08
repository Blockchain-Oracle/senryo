/**
 * `@senryo/account` constants. The derivation constants are FROZEN: changing any of them changes every account
 * (references/mera/demos/shared/src/hd.ts — "Changing this mapping would change every derived address").
 */

import { ONE_USD6 } from "@senryo/core";

/** PRF output length Mera returns (bytes) = 256 bits of BIP-39 entropy → a 24-word phrase. */
export const PRF_OUTPUT_BYTES = 32;

/** BIP-44 external chain on coin type 60 (the MetaMask convention); index 0 is the Senryo account. FROZEN. */
export const ACCOUNT_INDEX = 0;
export const derivationPath = (index: number): string => `m/44'/60'/0'/0/${index}`;

/** Relying-party display name the authenticator may show next to the passkey. */
export const RP_NAME = "Senryo";
/** WebAuthn `user.name`; the picker distinguishes passkeys by the dated display name below. */
export const PASSKEY_USER_NAME = "senryo";
const ISO_MINUTE = "YYYY-MM-DDTHH:MM".length;
/** `Senryo · 2026-09-30 14:02 UTC` — every create adds a passkey, so the label tells them apart in the picker. */
export const passkeyDisplayName = (at: Date): string =>
  `Senryo · ${at.toISOString().slice(0, ISO_MINUTE).replace("T", " ")} UTC`;

/** Session timing (spec client.md "Session policy"): absolute TTL and idle lock. */
export const SECONDS = 1_000;
export const MINUTES = 60 * SECONDS;
export const SESSION_TTL_MS = 30 * MINUTES;
export const SESSION_IDLE_MS = 5 * MINUTES;
/** Chip switches to "LOCKS IN m:ss" and the ticket warns (`warn` haptic) inside this window (F04). */
export const SESSION_WARN_MS = 60 * SECONDS;
/** Choices a user may pick in Security; anything longer than the default is "loosening" and needs step-up. */
export const SESSION_TTL_CHOICES_MS = [5 * MINUTES, 15 * MINUTES, 30 * MINUTES, 60 * MINUTES] as const;
export const SESSION_IDLE_CHOICES_MS = [1 * MINUTES, 5 * MINUTES, 15 * MINUTES] as const;

/** Money in the policy is usd6 (AUSD/USDC are 6-decimal stables, valued at par). Per-trade Face ID threshold on mainnet (D-037): trades at or above it confirm with Face ID. */
export const FACE_ID_TRADE_THRESHOLD_USD6 = 50n * ONE_USD6;
/** On-chain SessionGrant caps (D-267: per call, per session, expiry) replace the old trade caps in S2. */
/** Signed transactions per rolling minute inside a session (reduce-only actions are exempt). */
export const SESSION_RATE_PER_MINUTE = 20;

/** Messages the session may sign without a prompt (spec client.md). */
export const MESSAGE_PREFIXES = ["Senryo:push:"] as const;
/** SIWE messages signed in session must expire within this window. */
export const SIWE_MAX_TTL_MS = 10 * MINUTES;

/** Hint + unlock storage keys (versioned). Only the unlock item holds secret bytes (native, biometric-gated). */
export const STORAGE = {
  hint: "senryo.account.v1",
  unlock: "senryo.unlock.v1",
  channel: "senryo.session.v1",
  /** The one-tap delegate key per owner and network (`<prefix>.<chainId>.<owner>`, D-280). */
  delegate: "senryo.delegate.v1",
} as const;

/** HKDF info strings for keys derived from the PRF output (never the signing key). */
export const HKDF_INFO = { prefs: "senryo.prefs.v1" } as const;
