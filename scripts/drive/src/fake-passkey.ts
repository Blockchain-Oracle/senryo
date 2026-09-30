import { createHmac, randomBytes } from "node:crypto";
import type { AccountHint, PasskeyPlatform, SecretStore } from "@senryo/account";

/**
 * Node stand-ins for the platform seams (drive scripts only — never shipped): a virtual authenticator with PRF (HMAC
 * of a per-credential secret over the salt, like CTAP2 hmac-secret) behind Mera's `WebAuthnClient` interface, and an
 * in-memory hint store. The real `AccountClient`, Mera derivation, policy and scoped signer run unchanged on top.
 */

type WebAuthnClient = NonNullable<PasskeyPlatform["webAuthnClient"]>;
type CreateRequest = Parameters<WebAuthnClient["createCredential"]>[0];
type GetRequest = Parameters<WebAuthnClient["getCredential"]>[0];

const CREDENTIAL_ID_BYTES = 16;
const CREDENTIAL_SECRET_BYTES = 32;
const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");

class NotAllowed extends Error {
  override name = "NotAllowedError";
}

export class VirtualAuthenticator implements WebAuthnClient {
  readonly #secrets = new Map<string, Buffer>();
  /** Every ceremony this authenticator answered (create + get) — the prompt count. */
  ceremonies = 0;
  /** The credential that answers a discoverable (no allowCredential) request. */
  discoverable: string | undefined;

  readonly createCredential = async (request: CreateRequest) => {
    this.ceremonies += 1;
    const id = randomBytes(CREDENTIAL_ID_BYTES);
    const secret = randomBytes(CREDENTIAL_SECRET_BYTES);
    this.#secrets.set(b64(id), secret);
    this.discoverable ??= b64(id);
    return {
      credentialId: new Uint8Array(id),
      transports: ["internal" as const],
      prfEnabled: true,
      prfOutput: this.#prf(secret, request.prfSalt),
    };
  };

  readonly getCredential = async (request: GetRequest) => {
    this.ceremonies += 1;
    const id = request.allowCredential ? b64(request.allowCredential.credentialId) : this.discoverable;
    const secret = id ? this.#secrets.get(id) : undefined;
    if (!id || !secret) throw new NotAllowed("no matching passkey");
    return {
      credentialId: new Uint8Array(Buffer.from(id, "base64url")),
      prfOutput: this.#prf(secret, request.prfSalt),
    };
  };

  /** Credential ids in creation order (the main passkey first). */
  get ids(): string[] {
    return [...this.#secrets.keys()];
  }

  #prf(secret: Buffer, salt: Uint8Array): Uint8Array {
    return new Uint8Array(createHmac("sha256", secret).update(salt).digest());
  }
}

export function memoryStore(): SecretStore {
  let hint: AccountHint | undefined;
  return {
    kind: "web",
    readHint: async () => hint,
    writeHint: async (next) => {
      hint = next;
    },
    canPersistUnlock: async () => false,
    storeUnlock: async () => {},
    readUnlock: async () => ({ status: "absent" }),
    clear: async () => {
      hint = undefined;
    },
  };
}
