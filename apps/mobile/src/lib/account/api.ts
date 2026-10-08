/**
 * Senryo API access for the account surfaces (S6.12): one `@senryo/api-client` instance on `ENV.API_ORIGIN`
 * (`parsePublicEnv`; `EXPO_PUBLIC_API_ORIGIN` points a local `services/api` at it) and the SIWE session that `session`
 * routes (prefs) need. The Mera session signs the server's EIP-4361 text — in scope (our domain, this chain, a nonce,
 * ≤ 10 min expiry), so no prompt while unlocked. The bearer token lives in memory only.
 */
import type { AccountClient, Address, PolicyContext } from "@senryo/account";
import { defaultFaceIdMode, type FaceIdMode } from "@senryo/account";
import { type ApiClient, ApiError, authNonceRoute, authVerifyRoute, createApiClient } from "@senryo/api-client";
import type { ChainId } from "@senryo/config";
import { DEVICE_ID_BYTES } from "~/lib/constants/auth";
import { devApi, setDevProfileAddress } from "~/lib/dev/api";
import { DEV_WORKSPACE } from "~/lib/dev/config";
import { ENV } from "~/lib/env";
import { activeNetwork, type NetworkKey } from "~/lib/network";
import { STORAGE_KEYS, storage } from "~/lib/storage";

const HTTP_UNAUTHORIZED = 401;
const HEX_RADIX = 16;
const HEX_PER_BYTE = 2;

let client: ApiClient | undefined;
/** One API session per (address, chain): the SIWE message binds a chain, so a switch never reuses the other one. */
let session: { token: string; address: Address; chainId: ChainId; expiresAt: number } | undefined;
/** The sign-in in flight, shared by every caller for the same (address, chain). */
let signingIn: { key: string; done: Promise<void> } | undefined;
/** Told when an API session starts or ends (the live stream adds or drops the user's topic, D-280). */
const sessionListeners = new Set<(scope: { address: Address; chainId: ChainId } | undefined) => void>();

/** The account and chain an API session is live for right now, without signing in (no prompt). */
export function apiSessionScope(): { address: Address; chainId: ChainId } | undefined {
  return session && session.expiresAt > Date.now() ? { address: session.address, chainId: session.chainId } : undefined;
}

export function onApiSession(listener: (scope: { address: Address; chainId: ChainId } | undefined) => void) {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

function announceSession(): void {
  const scope = apiSessionScope();
  for (const l of sessionListeners) l(scope);
}

/** Per-install id for the relay's rate limit (`x-senryo-device`): random, MMKV, not an identity. */
function deviceId(): string {
  const existing = storage.getString(STORAGE_KEYS.device);
  if (existing) return existing;
  const bytes = new Uint8Array(DEVICE_ID_BYTES);
  crypto.getRandomValues(bytes);
  const id = Array.from(bytes, (b) => b.toString(HEX_RADIX).padStart(HEX_PER_BYTE, "0")).join("");
  storage.set(STORAGE_KEYS.device, id);
  return id;
}

export function api(): ApiClient {
  if (DEV_WORKSPACE) return devApi;
  client ??= createApiClient({ origin: ENV.API_ORIGIN, deviceHash: deviceId(), getToken: () => session?.token });
  return client;
}

const FACE_ID_STRICTNESS: Record<FaceIdMode, number> = { off: 0, "above-threshold": 1, "every-trade": 2 };

/**
 * The Face ID mode a network actually uses (S8.22, D-037): practice follows the setting (default off); mainnet is
 * never weaker than its default, so a practice "off" can't carry into real money.
 */
export function effectiveFaceId(network: NetworkKey, stored: FaceIdMode | undefined): FaceIdMode {
  const fallback = defaultFaceIdMode(network);
  const chosen = stored ?? fallback;
  if (network !== "mainnet") return chosen;
  return FACE_ID_STRICTNESS[chosen] >= FACE_ID_STRICTNESS[fallback] ? chosen : fallback;
}

/**
 * What the scoped signer checks every signature against (S8 adds market room and equity reads). Read at signing
 * time, so the chain and the Face ID mode always follow the selected network.
 */
export function policyContext(address: Address, faceId: PolicyContext["faceId"] | undefined): () => PolicyContext {
  return () => {
    const network = activeNetwork();
    return {
      chainId: network.chainId,
      self: address,
      faceId: effectiveFaceId(network.key, faceId),
      marketRoomUsd6: () => undefined,
      equityUsd6: () => undefined,
    };
  };
}

/**
 * A valid API session for the signed-in account (SIWE: nonce → in-session signMessage → verify). Single-flight per
 * (address, chain): the screens that mount together after a switch share one sign-in — one unlock prompt, one nonce —
 * instead of racing several into the nonce rate limit and stacked Face ID/passkey sheets.
 */
export function ensureApiSession(account: AccountClient, faceId?: PolicyContext["faceId"]): Promise<void> {
  if (DEV_WORKSPACE) {
    if (account.hint) setDevProfileAddress(account.hint.address);
    return Promise.resolve();
  }
  const address = account.hint?.address;
  if (!address) return Promise.reject(new Error("No account on this device"));
  const chainId = activeNetwork().chainId;
  if (session && session.address === address && session.chainId === chainId && session.expiresAt > Date.now())
    return Promise.resolve();
  const key = `${address.toLowerCase()}:${chainId}`;
  if (signingIn?.key === key) return signingIn.done;
  const done = signIn(account, address, chainId, faceId).finally(() => {
    if (signingIn?.done === done) signingIn = undefined;
  });
  signingIn = { key, done };
  return done;
}

async function signIn(account: AccountClient, address: Address, chainId: ChainId, faceId?: PolicyContext["faceId"]) {
  const challenge = await api().call(authNonceRoute, { body: { address, chainId } });
  const signature = await account.signer(policyContext(address, faceId)).signMessage({ message: challenge.message });
  const verified = await api().call(authVerifyRoute, { body: { message: challenge.message, signature } });
  // A switch or sign-out while this was in flight: never adopt a token for a scope the app has left.
  if (account.hint?.address !== address || activeNetwork().chainId !== chainId) return;
  session = { token: verified.token, address, chainId, expiresAt: Date.parse(verified.expiresAt) };
  announceSession();
}

export function clearApiSession(): void {
  session = undefined;
  signingIn = undefined;
  announceSession();
}

/** Runs a session route; a token the server no longer knows (restart, expiry) is replaced once, then retried. */
export async function withSession<T>(
  account: AccountClient,
  faceId: PolicyContext["faceId"] | undefined,
  run: () => Promise<T>,
): Promise<T> {
  await ensureApiSession(account, faceId);
  try {
    return await run();
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== HTTP_UNAUTHORIZED) throw error;
    clearApiSession();
    await ensureApiSession(account, faceId);
    return run();
  }
}
