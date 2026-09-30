/** Hint (de)serialisation shared by both stores: validates untrusted stored JSON; anything malformed reads as absent. */
import { parseSecretVault } from "@category-labs/mera";
import { type Address, getAddress, isAddress } from "viem";
import type { AccountHint } from "./types.ts";

/** Credential ids are canonical unpadded base64url (Mera); cap the length like the Mera demo's storage guard. */
const CREDENTIAL_ID = /^[A-Za-z0-9_-]{1,2048}$/;

export function encodeHint(hint: AccountHint): string {
  return JSON.stringify(hint);
}

export function decodeHint(raw: string | null | undefined): AccountHint | undefined {
  if (!raw) return undefined;
  try {
    const v = JSON.parse(raw) as Partial<AccountHint> & {
      credential?: { credentialId?: unknown; transports?: unknown };
    };
    if (typeof v.address !== "string" || !isAddress(v.address)) return undefined;
    const id = v.credential?.credentialId;
    if (typeof id !== "string" || !CREDENTIAL_ID.test(id)) return undefined;
    if (v.mode !== "passkey" && v.mode !== "vault") return undefined;
    const transports = Array.isArray(v.credential?.transports)
      ? v.credential.transports.filter((t): t is string => typeof t === "string")
      : undefined;
    const vault = v.mode === "vault" ? parseSecretVault(v.vault) : undefined;
    return {
      address: getAddress(v.address) as Address,
      credential: { credentialId: id, ...(transports ? { transports } : {}) },
      mode: v.mode,
      ...(vault ? { vault } : {}),
      savedAt: typeof v.savedAt === "number" ? v.savedAt : 0,
    };
  } catch {
    return undefined;
  }
}
