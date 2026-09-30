/**
 * Senryo API access for the account surfaces (S6.12): one `@senryo/api-client` instance on `ENV.API_ORIGIN`
 * (`parsePublicEnv`; `EXPO_PUBLIC_API_ORIGIN` points a local `services/api` at it) and the SIWE session that `session`
 * routes (prefs) need. The Mera session signs the server's EIP-4361 text — in scope (our domain, this chain, a nonce,
 * ≤ 10 min expiry), so no prompt while unlocked. The bearer token lives in memory only.
 */
import type { AccountClient, Address, PolicyContext } from "@senryo/account";
import { defaultFaceIdMode } from "@senryo/account";
import { type ApiClient, ApiError, authNonceRoute, authVerifyRoute, createApiClient } from "@senryo/api-client";
import { ACTIVE_NETWORK, DEVICE_ID_BYTES } from "~/lib/constants/auth";
import { ENV } from "~/lib/env";
import { STORAGE_KEYS, storage } from "~/lib/storage";

const HTTP_UNAUTHORIZED = 401;
const HEX_RADIX = 16;
const HEX_PER_BYTE = 2;

let client: ApiClient | undefined;
let session: { token: string; address: Address; expiresAt: number } | undefined;

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
  client ??= createApiClient({ origin: ENV.API_ORIGIN, deviceHash: deviceId(), getToken: () => session?.token });
  return client;
}

/** What the scoped signer checks every signature against (S8 adds market room and equity reads). */
export function policyContext(address: Address, faceId: PolicyContext["faceId"] | undefined): () => PolicyContext {
  return () => ({
    chainId: ACTIVE_NETWORK.chainId,
    self: address,
    faceId: faceId ?? defaultFaceIdMode(ACTIVE_NETWORK.key),
    marketRoomUsd6: () => undefined,
    equityUsd6: () => undefined,
  });
}

/** A valid API session for the signed-in account (SIWE: nonce → in-session signMessage → verify). */
export async function ensureApiSession(account: AccountClient, faceId?: PolicyContext["faceId"]): Promise<void> {
  const address = account.hint?.address;
  if (!address) throw new Error("No account on this device");
  if (session && session.address === address && session.expiresAt > Date.now()) return;
  const challenge = await api().call(authNonceRoute, { body: { address, chainId: ACTIVE_NETWORK.chainId } });
  const signature = await account.signer(policyContext(address, faceId)).signMessage({ message: challenge.message });
  const verified = await api().call(authVerifyRoute, { body: { message: challenge.message, signature } });
  session = { token: verified.token, address, expiresAt: Date.parse(verified.expiresAt) };
}

export function clearApiSession(): void {
  session = undefined;
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
