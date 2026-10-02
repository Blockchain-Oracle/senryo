/**
 * Encrypted session prefs on S3's untrusted storage (`/v1/prefs`, D-040, S6.12) — the same blob the web writes:
 * AES-256-GCM under a key derived from the account (D-152), pure JS on Hermes. The phone stays the source of truth:
 * sync only while the session is live (never a prompt for a background sync), and a synced value is adopted only when
 * it is at least as strict as this phone's — loosening always takes a step-up here. The starred markets sync too, last
 * writer wins (`WatchlistSync`). Every write merges into the stored blob. (Backup-passkey vaults stay web-first on
 * mobile, D-150.)
 */
import {
  type AccountClient,
  defaultFaceIdMode,
  isLoosening,
  mergePrefs,
  type PolicyContext,
  type Prefs,
  type SessionSettings,
  type SyncedWatchlist,
} from "@senryo/account";
import {
  ApiError,
  prefsDeleteRoute,
  prefsGetRoute,
  prefsPutRoute,
  type SocialDelete,
  socialDeleteRoute,
} from "@senryo/api-client";
import { activeNetwork } from "~/lib/network";
import { api, withSession } from "./api";
import { parseSettings } from "./settings";

type FaceId = PolicyContext["faceId"] | undefined;

/** Last version this app read or wrote, per address (optimistic concurrency: `ifVersion`). */
const versions = new Map<string, number>();

const same = (a: SessionSettings, b: SessionSettings) =>
  a.ttlMs === b.ttlMs && a.idleMs === b.idleMs && (a.faceId ?? null) === (b.faceId ?? null);

async function readRemote(client: AccountClient, faceId: FaceId) {
  const remote = await withSession(client, faceId, () => api().call(prefsGetRoute, {}));
  const address = client.session.live()?.address;
  if (address) versions.set(address.toLowerCase(), remote.version);
  return remote;
}

/**
 * Read the stored blob, replace only `patch`'s fields, write it back (one re-read on a version conflict). Merging
 * keeps what another device or the web wrote — the watchlist survives a session-settings write and vice versa.
 */
async function writeMerged(client: AccountClient, faceId: FaceId, patch: Partial<Omit<Prefs, "v">>): Promise<void> {
  const live = client.session.live();
  if (!live) return;
  const key = live.address.toLowerCase();
  const attempt = async () => {
    const remote = await readRemote(client, faceId);
    const current = remote.blob ? client.openPrefs(remote.blob) : undefined;
    const blob = client.sealPrefs(mergePrefs(current, patch));
    return withSession(client, faceId, () => api().call(prefsPutRoute, { body: { blob, ifVersion: remote.version } }));
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

/** Encrypt and store this phone's session settings, keeping every other synced field. */
export function pushPrefs(client: AccountClient, settings: SessionSettings): Promise<void> {
  return writeMerged(client, settings.faceId, { session: settings });
}

/** Store the starred markets (only while the session is live — a background sync never prompts). */
export function pushWatchlist(client: AccountClient, faceId: FaceId, watchlist: SyncedWatchlist): Promise<void> {
  return writeMerged(client, faceId, { watchlist });
}

/** The synced watchlist, or undefined when none was ever stored (or the session isn't live). */
export async function pullWatchlist(client: AccountClient, faceId: FaceId): Promise<SyncedWatchlist | undefined> {
  if (!client.session.live()) return undefined;
  const remote = await readRemote(client, faceId);
  return remote.blob ? client.openPrefs(remote.blob)?.watchlist : undefined;
}

/** After an unlock: the synced settings when at least as strict as `local` and different; a first device seeds. */
export async function pullPrefs(client: AccountClient, local: SessionSettings): Promise<SessionSettings | undefined> {
  if (!client.session.live()) return undefined;
  const remote = await readRemote(client, local.faceId);
  if (!remote.blob) {
    await pushPrefs(client, local);
    return undefined;
  }
  const synced = parseSettings(client.openPrefs(remote.blob)?.session);
  if (!synced || same(synced, local)) return undefined;
  return isLoosening(local, synced, defaultFaceIdMode(activeNetwork().key)) ? undefined : synced;
}

/**
 * A9: remove what Senryo keeps for this account (needs the live session to authenticate, one unlock at most). One
 * server call deletes the social data, price alerts, push tokens, backup vaults, inbox watches and encrypted prefs,
 * and strips notification content and analytics links (defect 10); the prefs route is asked too, for an api from
 * before that. The handle stays held 30 days so nobody can take it over.
 */
export async function deleteRemoteData(client: AccountClient, faceId: FaceId): Promise<SocialDelete> {
  const address = client.session.live()?.address;
  const outcome = await withSession(client, faceId, async () => {
    const deleted = await api().call(socialDeleteRoute, {});
    await api()
      .call(prefsDeleteRoute, {})
      .catch(() => undefined);
    return deleted;
  });
  if (address) versions.delete(address.toLowerCase());
  return outcome;
}
