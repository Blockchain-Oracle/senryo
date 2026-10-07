import { AccountClient, type AccountHint, DEFAULT_SETTINGS, type SecretStore } from "@senryo/account";
import { RP_ID } from "@senryo/config";
import { setDevProfileAddress } from "./api";
import { devControl, requireDevWorkspace } from "./config";

/** Public, deterministic LOCAL-FORK credential. Never stored in Keychain or used on a public network. */
const CREDENTIAL_BYTES = 16;
const CREDENTIAL_BYTE = 42;
const ROOT_BYTES = 32;
const ROOT_BYTE = 7;
const credential = () => new Uint8Array(CREDENTIAL_BYTES).fill(CREDENTIAL_BYTE);
const root = () => new Uint8Array(ROOT_BYTES).fill(ROOT_BYTE);

export function createDevAccountClient(): AccountClient {
  requireDevWorkspace();
  let hint: AccountHint | undefined;
  const store: SecretStore = {
    kind: "native",
    readHint: async () => hint,
    writeHint: async (next) => {
      hint = next;
    },
    canPersistUnlock: async () => true,
    storeUnlock: async () => {},
    readUnlock: async () => ({ status: "ok", credentialId: hint?.credential.credentialId ?? "", prfOutput: root() }),
    clear: async () => {
      hint = undefined;
    },
  };
  return new AccountClient({
    rpId: RP_ID,
    settings: { ...DEFAULT_SETTINGS, faceId: "off" },
    store,
    passkey: {
      kind: "native",
      webAuthnClient: {
        createCredential: async () => ({
          credentialId: credential(),
          transports: ["internal"],
          prfEnabled: true,
          prfOutput: root(),
        }),
        getCredential: async () => ({ credentialId: credential(), prfOutput: root() }),
      },
    },
  });
}

export async function prepareDevAccount(client: AccountClient): Promise<AccountHint | undefined> {
  requireDevWorkspace();
  await client.create();
  await devControl("prepare", { address: client.hint?.address });
  if (client.hint) setDevProfileAddress(client.hint.address);
  return client.hint;
}
