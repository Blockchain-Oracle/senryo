/**
 * Mera ceremonies with prompt counting. Every WebAuthn call is counted as it starts, so the UI can show "One more
 * confirmation" between the two prompts some authenticators need at creation (D-029), and S6 can record prompt counts
 * per authenticator. Native wraps the React Native client; web shadows `navigator.credentials` for the duration of
 * the ceremony only (Mera's browser client is internal) and restores it in `finally`.
 */
import {
  createPasskeyWithPrfOutput,
  getPasskeyPrfOutput,
  type PasskeyCredentialMetadata,
  type WebAuthnClient,
} from "@category-labs/mera";
import { PASSKEY_USER_NAME, passkeyDisplayName, RP_NAME } from "./constants.ts";
import type { Ceremony } from "./measure.ts";
import type { PasskeyPlatform } from "./platform/types.ts";

export type PromptListener = (ceremony: Ceremony, index: number) => void;

interface Counter {
  count: number;
  onPrompt: PromptListener | undefined;
}

function tick(counter: Counter, ceremony: Ceremony): void {
  counter.count += 1;
  counter.onPrompt?.(ceremony, counter.count);
}

function countingClient(base: WebAuthnClient, counter: Counter): WebAuthnClient {
  return {
    createCredential: (request) => {
      tick(counter, "passkey-create");
      return base.createCredential(request);
    },
    getCredential: (request) => {
      tick(counter, "passkey-get");
      return base.getCredential(request);
    },
  };
}

type CredentialsLike = { create: CredentialsContainer["create"]; get: CredentialsContainer["get"] };

async function withBrowserCount<T>(counter: Counter, fn: () => Promise<T>): Promise<T> {
  const container = globalThis.navigator?.credentials as (CredentialsLike & object) | undefined;
  if (!container) return fn();
  const create = container.create.bind(container);
  const get = container.get.bind(container);
  const shadow = container as CredentialsLike;
  shadow.create = (options) => {
    tick(counter, "passkey-create");
    return create(options);
  };
  shadow.get = (options) => {
    tick(counter, "passkey-get");
    return get(options);
  };
  try {
    return await fn();
  } finally {
    // Remove the own-property shadows; the prototype methods show through again.
    Reflect.deleteProperty(container, "create");
    Reflect.deleteProperty(container, "get");
  }
}

export interface Counted<T> {
  result: T;
  prompts: number;
}

async function counted<T>(
  platform: PasskeyPlatform,
  onPrompt: PromptListener | undefined,
  fn: (client: WebAuthnClient | undefined) => Promise<T>,
): Promise<Counted<T>> {
  const counter: Counter = { count: 0, onPrompt };
  const base = platform.webAuthnClient;
  const result = base ? await fn(countingClient(base, counter)) : await withBrowserCount(counter, () => fn(undefined));
  return { result, prompts: counter.count };
}

const clientOption = (client: WebAuthnClient | undefined) => (client ? { webAuthnClient: client } : {});

/** Create a new passkey (a new account). One prompt, two on authenticators without create-time PRF. */
export function createPasskey(platform: PasskeyPlatform, rpId: string, now: Date, onPrompt?: PromptListener) {
  return counted(platform, onPrompt, (client) =>
    createPasskeyWithPrfOutput({
      rp: { id: rpId, name: RP_NAME },
      user: { name: PASSKEY_USER_NAME, displayName: passkeyDisplayName(now) },
      ...clientOption(client),
    }),
  );
}

/** Discoverable (no `credential`: the platform offers every passkey for the rpId) or pinned assertion. */
export function getPasskey(
  platform: PasskeyPlatform,
  rpId: string,
  credential: PasskeyCredentialMetadata | undefined,
  onPrompt?: PromptListener,
) {
  return counted(platform, onPrompt, (client) =>
    getPasskeyPrfOutput({ rpId, ...(credential ? { credential } : {}), ...clientOption(client) }),
  );
}

/** Runs any Mera call that takes a `webAuthnClient` (vault helpers) with prompt counting. */
export function withCeremony<T>(
  platform: PasskeyPlatform,
  onPrompt: PromptListener | undefined,
  fn: (clientOption: { webAuthnClient?: WebAuthnClient }) => Promise<T>,
) {
  return counted(platform, onPrompt, (client) => fn(clientOption(client)));
}
