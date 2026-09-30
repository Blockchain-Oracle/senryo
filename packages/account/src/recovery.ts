/**
 * Recovery (D-034, F07): passkey sync first; a **second passkey** that can open the same account through a Mera
 * secret vault (the 24-word root encrypted under the new passkey's PRF, AES-256-GCM, fresh salt — safe on untrusted
 * storage); and, under Settings → Advanced only, the 24-word export. Every path starts with a pinned ceremony.
 */
import {
  createSecretVaultWithNewPasskey,
  decryptSecretVaultWithPasskey,
  getPasskeyPrfOutput,
  type PasskeySecretVault,
  parseSecretVault,
} from "@category-labs/mera";
import { isAddressEqual } from "viem";
import { getPasskey, withCeremony } from "./ceremony.ts";
import type { AccountClient } from "./client.ts";
import { PASSKEY_USER_NAME, RP_NAME } from "./constants.ts";
import { openAccountFromMnemonic, prfOutputToMnemonic } from "./derive.ts";
import { AuthError } from "./errors.ts";

const RECOVERY_LABEL_PREFIX = "Senryo recovery";
const ISO_DAY = "YYYY-MM-DD".length;

function derive(client: AccountClient) {
  const pbkdf2 = client.options.pbkdf2;
  return pbkdf2 ? { pbkdf2 } : {};
}

/** The account's 24 words behind a fresh ceremony, verified against the hinted address before returning. */
async function phraseBehindCeremony(client: AccountClient, onPrompt: Parameters<typeof withCeremony>[1]) {
  const hint = client.hint;
  if (!hint) throw new AuthError("no-credentials");
  const { rpId, passkey } = client.options;
  const out = await withCeremony(passkey, onPrompt, async (c) => {
    if (hint.mode === "vault" && hint.vault) {
      const bytes = await decryptSecretVaultWithPasskey({ rpId, vault: hint.vault, ...c });
      try {
        return new TextDecoder().decode(bytes);
      } finally {
        bytes.fill(0);
      }
    }
    const { prfOutput } = await getPasskeyPrfOutput({ rpId, credential: hint.credential, ...c });
    try {
      return prfOutputToMnemonic(prfOutput);
    } finally {
      prfOutput.fill(0);
    }
  });
  const opened = openAccountFromMnemonic(out.result, derive(client));
  opened.session.end();
  opened.prefsKey.fill(0);
  if (!isAddressEqual(opened.address, hint.address)) throw new AuthError("wrong-account");
  return out;
}

/** Settings → Advanced → Export (step-up). The caller shows it once, blocks screenshots, and drops it on background. */
export function revealRecoveryPhrase(client: AccountClient): Promise<string> {
  return client.run("reveal", async (onPrompt) => {
    const { result, prompts } = await phraseBehindCeremony(client, onPrompt);
    return { value: result, prompts };
  });
}

/**
 * Adds a second passkey that can open this account: one ceremony with the current passkey (reads the root), one
 * creation ceremony for the new passkey (encrypts it). Returns the vault JSON to keep on untrusted storage.
 */
export function addRecoveryPasskey(client: AccountClient, now: Date): Promise<PasskeySecretVault> {
  return client.run("vault-create", async (onPrompt) => {
    const phrase = await phraseBehindCeremony(client, onPrompt);
    const secret = new TextEncoder().encode(phrase.result);
    try {
      const created = await withCeremony(client.options.passkey, onPrompt, (c) =>
        createSecretVaultWithNewPasskey({
          rp: { id: client.options.rpId, name: RP_NAME },
          user: {
            name: PASSKEY_USER_NAME,
            displayName: `${RECOVERY_LABEL_PREFIX} · ${now.toISOString().slice(0, ISO_DAY)}`,
          },
          secret,
          ...c,
        }),
      );
      return { value: created.result, prompts: phrase.prompts + created.prompts };
    } finally {
      secret.fill(0);
    }
  });
}

/** Decrypt a vault behind its pinned passkey and adopt the account it protects on this device (mode `vault`). */
async function openVault(client: AccountClient, raw: unknown, onPrompt: Parameters<typeof withCeremony>[1]) {
  const vault = parseSecretVault(raw);
  const { result, prompts } = await withCeremony(client.options.passkey, onPrompt, (c) =>
    decryptSecretVaultWithPasskey({ rpId: client.options.rpId, vault, ...c }),
  );
  const phrase = new TextDecoder().decode(result);
  result.fill(0);
  const opened = openAccountFromMnemonic(phrase, derive(client));
  await client.adoptHint(
    { address: opened.address, credential: vault.credential, mode: "vault", vault, savedAt: Date.now() },
    opened,
  );
  return { value: opened.address, prompts };
}

/** Opens the account a vault (e.g. the recovery file) protects with its backup passkey. */
export function recoverWithVault(client: AccountClient, raw: unknown): Promise<`0x${string}`> {
  return client.run("vault-recover", (onPrompt) => openVault(client, raw, onPrompt));
}

/** The backup passkey has no vault on the server (it may be the main passkey — sign in normally instead). */
export class VaultNotFoundError extends Error {
  constructor() {
    super("No recovery vault for this passkey");
    this.name = "VaultNotFoundError";
  }
}

/**
 * Fresh-device recovery with no file (F08 + S3 `/v1/vault`): a discoverable assertion identifies the backup passkey
 * (its PRF is discarded at once), `fetchVault(credentialId)` reads the public vault record, then the vault opens behind
 * a second, pinned ceremony. Two prompts — recovery is rare and the vault salt is per-vault. The app supplies the
 * fetch (this package never talks to the network).
 */
export function recoverWithServerVault(
  client: AccountClient,
  fetchVault: (credentialId: string) => Promise<unknown | undefined>,
): Promise<`0x${string}`> {
  return client.run("vault-recover", async (onPrompt) => {
    const picked = await getPasskey(client.options.passkey, client.options.rpId, undefined, onPrompt);
    picked.result.prfOutput.fill(0);
    const raw = await fetchVault(picked.result.credentialId);
    if (raw === undefined) throw new VaultNotFoundError();
    const out = await openVault(client, raw, onPrompt);
    return { value: out.value, prompts: picked.prompts + out.prompts };
  });
}
