import { type Signer, signerFromPrivateKey } from "@senryo/chain";
import { readSecret, requireSecret } from "./env.ts";

/**
 * Operational signers (sponsor, card operators, keeper) from `<NAME>_PK` or `<NAME>_PK_FILE`. Only addresses are
 * ever logged. Services never hold a user's key (invariant `no-custody-backend`).
 */
export function loadSigner(name: string): Signer {
  return signerFromPrivateKey(requireSecret(`${name}_PK`), name);
}

export function loadOptionalSigner(name: string): Signer | undefined {
  const key = readSecret(`${name}_PK`);
  return key ? signerFromPrivateKey(key, name) : undefined;
}

/** Numbered keys `OPERATOR_1_PK … OPERATOR_n_PK` (card operator shards). */
export function loadSignerSet(prefix: string, max: number): Signer[] {
  const signers: Signer[] = [];
  for (let i = 1; i <= max; i += 1) {
    const signer = loadOptionalSigner(`${prefix}_${i}`);
    if (signer) signers.push(signer);
  }
  return signers;
}
