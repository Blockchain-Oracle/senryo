/**
 * Server copies on S3's untrusted storage (D-040, S6.12): the backup-passkey vault (`/v1/vault`) and the encrypted
 * session prefs (`/v1/prefs`). The server keeps opaque AES-GCM bytes it can neither read nor forge. The device stays the
 * source of truth: prefs sync only while the session is live (never a prompt for a background sync), and a remote
 * value is adopted only when it is at least as strict as this device's (D-152) — loosening always takes a step-up here.
 */
import {
  type AccountClient,
  type AccountHint,
  defaultFaceIdMode,
  isLoosening,
  type PolicyContext,
  PREFS_VERSION,
  type SessionSettings,
} from "@senryo/account";
import {
  ApiError,
  prefsDeleteRoute,
  prefsGetRoute,
  prefsPutRoute,
  type VaultPutRequest,
  vaultGetRoute,
  vaultPutRoute,
} from "@senryo/api-client";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { api, withSession } from "./api";
import { parseSettings } from "./settings";

const HTTP_NOT_FOUND = 404;
type FaceId = PolicyContext["faceId"] | undefined;

/** Last version this tab read or wrote, per address (optimistic concurrency: `ifVersion`). */
const versions = new Map<string, number>();

const same = (a: SessionSettings, b: SessionSettings) =>
  a.ttlMs === b.ttlMs && a.idleMs === b.idleMs && (a.faceId ?? null) === (b.faceId ?? null);

type Vault = NonNullable<AccountHint["vault"]>;

/** Mera's vault JSON as the route's schema reads it (mutable transports array). */
const toWire = (vault: Vault): VaultPutRequest["vault"] => ({
  ...vault,
  credential: {
    credentialId: vault.credential.credentialId,
    ...(vault.credential.transports ? { transports: [...vault.credential.transports] } : {}),
  },
});

/** Stores the vault a backup passkey opens (the recovery file's twin) so a fresh device needs no file. */
export async function saveVault(client: AccountClient, vault: Vault, label: string, faceId: FaceId): Promise<void> {
  const body = { vault: toWire(vault), label };
  await withSession(client, faceId, () => api().call(vaultPutRoute, { body }));
}

/** Public read by credential id (the vault is useless without its passkey); `undefined` when there is none. */
export async function fetchVault(credentialId: string): Promise<unknown | undefined> {
  try {
    return (await api().call(vaultGetRoute, { params: { credentialId } })).vault;
  } catch (error) {
    if (error instanceof ApiError && error.status === HTTP_NOT_FOUND) return undefined;
    throw error;
  }
}

async function readRemote(client: AccountClient, faceId: FaceId) {
  const remote = await withSession(client, faceId, () => api().call(prefsGetRoute, {}));
  const address = client.session.live()?.address;
  if (address) versions.set(address.toLowerCase(), remote.version);
  return remote;
}

/** Encrypt and store this device's settings (a stale version re-reads once and writes over it). */
export async function pushPrefs(client: AccountClient, settings: SessionSettings): Promise<void> {
  const live = client.session.live();
  if (!live) return;
  const key = live.address.toLowerCase();
  const blob = client.sealPrefs({ v: PREFS_VERSION, session: settings });
  const put = (ifVersion: number) =>
    withSession(client, settings.faceId, () => api().call(prefsPutRoute, { body: { blob, ifVersion } }));
  let written: { version: number };
  try {
    written = await put(versions.get(key) ?? (await readRemote(client, settings.faceId)).version);
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== "CONFLICT") throw error;
    written = await put((await readRemote(client, settings.faceId)).version);
  }
  versions.set(key, written.version);
}

/**
 * After an unlock: the synced settings when they are at least as strict as `local` and differ from it; otherwise
 * `undefined` (and a first device seeds the server with its own settings).
 */
export async function pullPrefs(client: AccountClient, local: SessionSettings): Promise<SessionSettings | undefined> {
  if (!client.session.live()) return undefined;
  const remote = await readRemote(client, local.faceId);
  if (!remote.blob) {
    await pushPrefs(client, local);
    return undefined;
  }
  const synced = parseSettings(client.openPrefs(remote.blob)?.session);
  if (!synced || same(synced, local)) return undefined;
  return isLoosening(local, synced, defaultFaceIdMode(ACTIVE_NETWORK.key)) ? undefined : synced;
}

/** F09: remove the encrypted prefs from the server (needs the live session to authenticate). */
export async function deleteRemotePrefs(client: AccountClient, faceId: FaceId): Promise<void> {
  const address = client.session.live()?.address;
  await withSession(client, faceId, () => api().call(prefsDeleteRoute, {}));
  if (address) versions.delete(address.toLowerCase());
}
