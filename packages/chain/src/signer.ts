import type { LocalAccount } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * A sender's key. Services hold only **operational** keys (sponsor, card operators, keeper) — never a user's key
 * (invariant `no-custody-backend`: user keys stay in `packages/account` on the device). Keys come from runtime env or
 * `~/.config/senryo/*.key` (chmod 600) and are never logged.
 */
export type Signer = LocalAccount;

const PRIVATE_KEY_RE = /^0x[0-9a-fA-F]{64}$/;

export class InvalidKeyError extends Error {
  constructor(readonly label: string) {
    super(`${label}: not a 32-byte hex private key`);
    this.name = "InvalidKeyError";
  }
}

/** Build a signer from a hex private key; the error names the key's label, never its value. */
export function signerFromPrivateKey(privateKey: string, label = "key"): Signer {
  const trimmed = privateKey.trim();
  if (!PRIVATE_KEY_RE.test(trimmed)) throw new InvalidKeyError(label);
  return privateKeyToAccount(trimmed as `0x${string}`);
}
