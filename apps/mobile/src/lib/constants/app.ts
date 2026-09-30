/**
 * App identity and platform floors. The rpId host is owned by `@senryo/config` (frozen once the first account exists,
 * because the passkey rpId *is* the account); it is re-exported here for `app.config.ts`.
 */
import { ANDROID_PACKAGE, ASSOCIATED_DOMAINS, IOS_BUNDLE_ID, RP_ID } from "@senryo/config";

export { ASSOCIATED_DOMAINS, RP_ID };
export const APP = {
  name: "Senryo",
  slug: "senryo",
  scheme: "senryo",
  version: "0.1.0",
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
