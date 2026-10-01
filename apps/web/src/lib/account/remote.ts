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
  mergePrefs,
  type PolicyContext,
  type SessionSettings,
} from "@senryo/account";
import {
  ApiError,
  prefsDeleteRoute,
  prefsGetRoute,
  prefsPutRoute,
  socialDeleteRoute,
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

/**
 * Encrypt and store this device's settings, merged into the stored blob so fields another device wrote (the phone's
 * synced watchlist) are kept (one re-read on a version conflict).
 */
export async function pushPrefs(client: AccountClient, settings: SessionSettings): Promise<void> {
  const live = client.session.live();
  if (!live) return;
  const key = live.address.toLowerCase();
  const attempt = async () => {
    const remote = await readRemote(client, settings.faceId);
    const current = remote.blob ? client.openPrefs(remote.blob) : undefined;
    const blob = client.sealPrefs(mergePrefs(current, { session: settings }));
    return withSession(client, settings.faceId, () =>
      api().call(prefsPutRoute, { body: { blob, ifVersion: remote.version } }),
    );
  };
  let written: { version: number };
  try {
    written = await attempt();
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== "CONFLICT") throw error;
    written = await attempt();
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

/**
 * F09: remove what Senryo keeps for this account (needs the live session to authenticate, one unlock at most): the
 * encrypted prefs, then the social data (S12b, D-217). The profile, posts, likes, follows, blocks, mutes and own
 * reports are deleted; the handle stays held 30 days so nobody can take it over.
 */
export async function deleteRemoteData(client: AccountClient, faceId: FaceId): Promise<void> {
  const address = client.session.live()?.address;
  await withSession(client, faceId, async () => {
    await api().call(prefsDeleteRoute, {});
    await api().call(socialDeleteRoute, {});
  });
  if (address) versions.delete(address.toLowerCase());
}
