/** Limits shared by services/api (enforced) and the clients (pre-checked). */

/** SIWE message statement (EIP-4361) — the signer policy in packages/account allows exactly this format. */
export const SIWE_STATEMENT = "Sign in to Senryo.";
/** A SIWE challenge must be signed and verified within this window. */
export const SIWE_CHALLENGE_TTL_SECONDS = 300;
/** API session (JWT) lifetime after a verified SIWE signature. */
export const API_SESSION_TTL_SECONDS = 43_200;
/** SIWE message text cap (a real message is ~450 bytes). */
export const SIWE_MESSAGE_MAX_CHARS = 2_000;

/** Header carrying the per-install device hash (rate limits per device, services.md). Never PII. */
export const DEVICE_HEADER = "x-senryo-device";
export const DEVICE_HASH_MAX_CHARS = 128;

/** Encrypted prefs blob (HKDF(prf, "senryo.prefs.v1") AES-GCM, base64url) — the server stores opaque bytes. */
export const PREFS_BLOB_MAX_CHARS = 65_536;
/** Mera secret-vault JSON (v1) is ~300 bytes; the cap leaves room for transports and a label. */
export const VAULT_MAX_CHARS = 4_096;
export const VAULT_LABEL_MAX_CHARS = 64;
/** Vaults per account (second passkeys). */
export const VAULTS_PER_ACCOUNT_MAX = 5;
