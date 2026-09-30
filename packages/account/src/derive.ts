/**
 * FROZEN derivation — PRF output → BIP-39 (24 words) → seed (PBKDF2, empty passphrase) → BIP-32 `m/44'/60'/0'/0/0`
 * → secp256k1 key → Mera signing session. Identical to `references/mera/demos/shared/src/hd.ts` on every platform,
 * so the same passkey gives the same address on web, iOS and Android, and the 24 words import into any HD wallet.
 *
 * The only platform difference allowed is *how* PBKDF2 runs (JS on web, native quick-crypto on Hermes); the parity
 * check (`checks/derivation.check.ts`) proves both produce the same seed and address. Secret buffers are zeroed on
 * the way out; the mnemonic string cannot be (JS strings are immutable) and is never stored or logged.
 */
import {
  createSecp256k1SigningSession,
  type EvmAddress,
  getEvmAddress,
  type Secp256k1SigningSession,
} from "@category-labs/mera";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { ACCOUNT_INDEX, derivationPath, HKDF_INFO, PRF_OUTPUT_BYTES } from "./constants.ts";

/** BIP-39 §"From mnemonic to seed": PBKDF2-HMAC-SHA512, 2048 rounds, 64-byte seed, salt "mnemonic" + passphrase. */
const BIP39_ROUNDS = 2048;
const BIP39_SEED_BYTES = 64;
const BIP39_SALT_PREFIX = "mnemonic";

/** A synchronous PBKDF2-HMAC-SHA512 (Node's / react-native-quick-crypto's `pbkdf2Sync` signature, digest fixed). */
export type Pbkdf2Sha512 = (password: Uint8Array, salt: Uint8Array, rounds: number, keyLength: number) => Uint8Array;

export interface DeriveOptions {
  /** Native-accelerated PBKDF2; omitted → @scure/bip39's JS implementation (the web path). */
  pbkdf2?: Pbkdf2Sha512;
  /** Account index; only 0 is used by Senryo (FROZEN). Exposed for the parity vectors. */
  index?: number;
}

export interface OpenedAccount {
  session: Secp256k1SigningSession;
  address: EvmAddress;
  /**
   * AES-256 key for the encrypted prefs blob (`/v1/prefs`): HKDF-SHA256(account key, info "senryo.prefs.v1"). A function
   * of the *account*, so the passkey path and the backup-passkey (vault) path reach the same prefs (D-152). Held only
   * with the live session and zeroed with it; never persisted.
   */
  prefsKey: Uint8Array;
}

const PREFS_KEY_BYTES = 32;

/** PRF output (32 bytes) → 24-word BIP-39 phrase (the PRF bytes are the entropy). */
export function prfOutputToMnemonic(prfOutput: Uint8Array): string {
  if (prfOutput.length !== PRF_OUTPUT_BYTES) throw new Error("PRF output must be 32 bytes");
  return entropyToMnemonic(prfOutput, wordlist);
}

export function isValidMnemonic(mnemonic: string): boolean {
  return validateMnemonic(mnemonic.trim(), wordlist);
}

/** BIP-39 seed. With `pbkdf2` it runs the same function natively; without it, @scure's JS path (web). */
export function mnemonicToSeed(mnemonic: string, pbkdf2?: Pbkdf2Sha512): Uint8Array {
  if (pbkdf2 === undefined) return mnemonicToSeedSync(mnemonic);
  const encoder = new TextEncoder();
  const password = encoder.encode(mnemonic.normalize("NFKD"));
  const salt = encoder.encode(BIP39_SALT_PREFIX.normalize("NFKD"));
  try {
    return Uint8Array.from(pbkdf2(password, salt, BIP39_ROUNDS, BIP39_SEED_BYTES));
  } finally {
    password.fill(0);
  }
}

/** secp256k1 private key for EVM account `index` (BIP-32 over BIP-44). The caller zeroes it. */
export function deriveEvmPrivateKey(seed: Uint8Array, index: number = ACCOUNT_INDEX): Uint8Array {
  const node = HDKey.fromMasterSeed(seed).derive(derivationPath(index));
  if (!node.privateKey) throw new Error("BIP-32 derivation produced no private key");
  return Uint8Array.from(node.privateKey);
}

/** Seed → signing session. Zeroes the seed and the transient key; BIP-32 node keys linger until GC (Mera note). */
function openFromSeed(seed: Uint8Array, index: number): OpenedAccount {
  let privateKey: Uint8Array | undefined;
  try {
    privateKey = deriveEvmPrivateKey(seed, index);
    const session = createSecp256k1SigningSession({ privateKey });
    const prefsKey = hkdf(sha256, privateKey, undefined, utf8ToBytes(HKDF_INFO.prefs), PREFS_KEY_BYTES);
    return { session, address: getEvmAddress(session.publicKey), prefsKey };
  } finally {
    seed.fill(0);
    privateKey?.fill(0);
  }
}

/** The Senryo account from a passkey's PRF output. Zeroes `prfOutput`. */
export function openAccount(prfOutput: Uint8Array, options: DeriveOptions = {}): OpenedAccount {
  try {
    const seed = mnemonicToSeed(prfOutputToMnemonic(prfOutput), options.pbkdf2);
    return openFromSeed(seed, options.index ?? ACCOUNT_INDEX);
  } finally {
    prfOutput.fill(0);
  }
}

/** The account behind a recovery phrase (second-passkey vault recovery, D-034). */
export function openAccountFromMnemonic(mnemonic: string, options: DeriveOptions = {}): OpenedAccount {
  const phrase = mnemonic.trim();
  if (!isValidMnemonic(phrase)) throw new Error("Invalid recovery phrase");
  return openFromSeed(mnemonicToSeed(phrase, options.pbkdf2), options.index ?? ACCOUNT_INDEX);
}
