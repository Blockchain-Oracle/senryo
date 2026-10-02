/**
 * Native modules added after a binary was built (S1b.13: notifications, Face ID). Their JS throws at import when the
 * running binary lacks them — a dev client from before they were added, which still loads today's bundle from the dev
 * server. So they are required lazily, only once the native side is known to be there; without it the caller gets
 * `undefined` and says plainly that this build can't do it yet.
 */
import { requireOptionalNativeModule } from "expo";
import type * as ExpoImage from "expo-image";
import type * as LocalAuthentication from "expo-local-authentication";
import type * as Notifications from "expo-notifications";

export type NotificationsModule = typeof Notifications;
export type LocalAuthModule = typeof LocalAuthentication;
export type ImageModule = typeof ExpoImage;

let notifications: NotificationsModule | null | undefined;
let localAuth: LocalAuthModule | null | undefined;
let image: ImageModule | null | undefined;

export function notificationsModule(): NotificationsModule | undefined {
  if (notifications === undefined) {
    notifications = requireOptionalNativeModule("ExpoPushTokenManager")
      ? (require("expo-notifications") as NotificationsModule)
      : null;
  }
  return notifications ?? undefined;
}

export function localAuthModule(): LocalAuthModule | undefined {
  if (localAuth === undefined) {
    localAuth = requireOptionalNativeModule("ExpoLocalAuthentication")
      ? (require("expo-local-authentication") as LocalAuthModule)
      : null;
  }
  return localAuth ?? undefined;
}

/** expo-image (runtime 0.2.0): decoded-bitmap memory cache for the welcome story; React Native's Image without it. */
export function imageModule(): ImageModule | undefined {
  if (image === undefined) {
    image = requireOptionalNativeModule("ExpoImage") ? (require("expo-image") as ImageModule) : null;
  }
  return image ?? undefined;
}
