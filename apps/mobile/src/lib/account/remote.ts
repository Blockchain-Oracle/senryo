/**
 * Encrypted session prefs on S3's untrusted storage (`/v1/prefs`, D-040, S6.12) — the same blob the web writes:
 * AES-256-GCM under a key derived from the account (D-152), pure JS on Hermes. The phone stays the source of truth:
 * sync only while the session is live (never a prompt for a background sync), and a synced value is adopted only when
 * it is at least as strict as this phone's — loosening always takes a step-up here. (Backup-passkey vaults stay
 * web-first on mobile, D-150.)
 */
import {
  type AccountClient,
  defaultFaceIdMode,
  isLoosening,
  type PolicyContext,
  PREFS_VERSION,
  type SessionSettings,
} from "@senryo/account";
import { ApiError, prefsDeleteRoute, prefsGetRoute, prefsPutRoute } from "@senryo/api-client";
import { ACTIVE_NETWORK } from "~/lib/constants/auth";
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

/** Encrypt and store this phone's settings (a stale version re-reads once and writes over it). */
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
  return isLoosening(local, synced, defaultFaceIdMode(ACTIVE_NETWORK.key)) ? undefined : synced;
}

/** F09: remove the encrypted prefs from the server (needs the live session to authenticate). */
export async function deleteRemotePrefs(client: AccountClient, faceId: FaceId): Promise<void> {
  const address = client.session.live()?.address;
  await withSession(client, faceId, () => api().call(prefsDeleteRoute, {}));
  if (address) versions.delete(address.toLowerCase());
}
