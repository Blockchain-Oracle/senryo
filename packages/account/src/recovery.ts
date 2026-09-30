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
import { withCeremony } from "./ceremony.ts";
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

/** Opens the account a vault protects with its (second) passkey and adopts it on this device (mode `vault`). */
export function recoverWithVault(client: AccountClient, raw: unknown): Promise<`0x${string}`> {
  return client.run("vault-recover", async (onPrompt) => {
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
  });
}
