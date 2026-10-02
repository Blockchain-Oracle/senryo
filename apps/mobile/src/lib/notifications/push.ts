/**
 * Push notifications on this phone (S1b.13, FT008/C07): the OS permission, the Expo push token, and its registration
 * with the Senryo api (`PUT /v1/push/token`, a session route) together with which kinds of news the account wants.
 * The keeper sends; the phone only says where and what. What was last registered is kept in MMKV so the settings page
 * opens on the real choices and a registration that failed is retried at the next unlock (`usePushSync`).
 */
import type { AccountClient, Address, FaceIdMode } from "@senryo/account";
import { PUSH_CHANNEL_DEFAULTS, type PUSH_CHANNELS, pushTokenDeleteRoute, pushTokenRoute } from "@senryo/api-client";
import { Platform } from "react-native";
import { api, withSession } from "~/lib/account/api";
import { countingPrompts } from "~/lib/account/system-prompt";
import { EAS } from "~/lib/constants/app";
import { notificationsModule } from "~/lib/native-modules";
import { STORAGE_KEYS, storage } from "~/lib/storage";

export type PushChannel = (typeof PUSH_CHANNELS)[number];
export type PushChannels = Record<PushChannel, boolean>;
/** `unavailable`: this build has no notifications module (a dev client from before it was added). */
export type PushPermission = "granted" | "denied" | "undetermined" | "unavailable";

/** Every channel at its default: on, except "a trader you follow opened a position" (opt-in, G1). */
export const DEFAULT_CHANNELS: PushChannels = { ...PUSH_CHANNEL_DEFAULTS };

interface Registration {
  token: string;
  address: string;
  channels: PushChannels;
  /** False while the api hasn't confirmed it: the next unlock tries again. */
  confirmed: boolean;
}

export function savedRegistration(): Registration | undefined {
  const raw = storage.getString(STORAGE_KEYS.push);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Registration;
    return { ...parsed, channels: { ...DEFAULT_CHANNELS, ...parsed.channels } };
  } catch {
    return undefined;
  }
}

function save(registration: Registration | undefined): void {
  if (registration) storage.set(STORAGE_KEYS.push, JSON.stringify(registration));
  else storage.remove(STORAGE_KEYS.push);
}

export async function readPushPermission(): Promise<PushPermission> {
  const notifications = notificationsModule();
  if (!notifications) return "unavailable";
  const { status } = await notifications.getPermissionsAsync();
  return status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
}

/** The OS prompt (asked once; afterwards iOS answers from Settings without showing anything). */
export async function askPushPermission(): Promise<PushPermission> {
  const notifications = notificationsModule();
  if (!notifications) return "unavailable";
  const { status } = await countingPrompts(notifications).requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
}

let tokenThisRun: string | undefined;

async function expoPushToken(): Promise<string> {
  const notifications = notificationsModule();
  if (!notifications) throw new Error("This build can't receive notifications");
  tokenThisRun ??= (await notifications.getExpoPushTokenAsync({ projectId: EAS.projectId })).data;
  return tokenThisRun;
}

/**
 * Registers this phone for `address` with `channels`. Recorded locally first (unconfirmed), so a failure here is
 * retried later rather than forgotten; throws what the token fetch or the api said.
 */
export async function registerPush(
  client: AccountClient,
  address: Address,
  faceId: FaceIdMode | undefined,
  channels: PushChannels,
): Promise<PushChannels> {
  const token = await expoPushToken();
  save({ token, address: address.toLowerCase(), channels, confirmed: false });
  const platform = Platform.OS === "android" ? "android" : "ios";
  const result = await withSession(client, faceId, () =>
    api().call(pushTokenRoute, { body: { token, platform, kind: "expo", channels } }),
  );
  const confirmed = { ...channels, ...(result.channels as Partial<PushChannels>) };
  save({ token, address: address.toLowerCase(), channels: confirmed, confirmed: true });
  return confirmed;
}

/**
 * Stops pushes to this phone (sign-out). Best effort: the phone always forgets its registration; the api is told only
 * when `online` (an unlocked session, so no prompt) and reachable — otherwise the token stays with the old account
 * until another account registers this phone or Expo reports it unregistered.
 */
export async function unregisterPush(
  client: AccountClient,
  faceId: FaceIdMode | undefined,
  online: boolean,
): Promise<void> {
  const saved = savedRegistration();
  save(undefined);
  if (!saved || !online) return;
  try {
    await withSession(client, faceId, () => api().call(pushTokenDeleteRoute, { body: { token: saved.token } }));
  } catch {
    // The token is disabled server-side the next time Expo reports it unregistered.
  }
}

/**
 * The channels this phone still owes the api for `address` (sent only when the OS permission is granted): never sent
 * (permission given in Settings, or a primer whose registration failed), or last sent for another account.
 */
export function registrationOwed(address: Address): PushChannels | undefined {
  const saved = savedRegistration();
  if (!saved) return DEFAULT_CHANNELS;
  if (saved.address === address.toLowerCase() && saved.confirmed) return undefined;
  return saved.address === address.toLowerCase() ? saved.channels : DEFAULT_CHANNELS;
}
