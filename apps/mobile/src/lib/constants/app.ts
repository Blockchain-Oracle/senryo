/**
 * App identity and platform floors. The rpId host is owned by `@senryo/config` (frozen once the first account exists,
 * because the passkey rpId *is* the account); it is re-exported here for `app.config.ts`.
 */
import { ANDROID_PACKAGE, APPLE_TEAM_ID, ASSOCIATED_DOMAINS, IOS_BUNDLE_ID, RP_ID } from "@senryo/config";

export { APPLE_TEAM_ID, ASSOCIATED_DOMAINS, RP_ID };
export const APP = {
  name: "Senryo",
  slug: "senryo",
  scheme: "senryo",
  // Runtime version (appVersion policy): 0.2.0 adds expo-image, expo-camera, expo-web-browser, expo-sharing and
  // react-native-view-shot, so OTA updates for it never reach 0.1.0 binaries that lack those modules.
  // A separate runtime keeps this TestFlight source pass independent of the earlier premium preview.
  version: "0.2.1",
  bundleId: IOS_BUNDLE_ID,
  androidPackage: ANDROID_PACKAGE,
} as const;

/** EAS project on the user's Expo account (`eas init`, 2026-09-30). Public identifiers, not secrets. */
export const EAS = {
  owner: "0xabu",
  projectId: "2d424d4b-644e-4231-a156-a8c63d802e9c",
} as const;

/** PRF passkeys need iOS 18+ / Android 9 (API 28)+ (platforms-and-stores §2). */
export const IOS_DEPLOYMENT_TARGET = "18.0";
export const ANDROID_MIN_SDK = 28;
export const ANDROID_BUILD_ARCHS = ["arm64-v8a"] as const;

/** Shown by iOS when SecureStore reads a biometric-gated item (the per-trade Face ID gate, D-028/D-037). */
export const FACE_ID_PERMISSION = "Senryo uses Face ID to unlock your account and confirm trades.";

/** Width (pt) of the seal on the splash plate; the plate colour is the D2 ground from `@senryo/tokens`. */
export const SPLASH_IMAGE_WIDTH = 96;
