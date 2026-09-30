/**
 * App identity and platform floors. This is the single home of the rpId host until `packages/config` lands (S6),
 * which then owns it and this file re-exports it. The domain is decided (D-049) and is frozen once the first account
 * is created, because the passkey rpId *is* the account.
 */
export const APP = {
  name: "Senryo",
  slug: "senryo",
  scheme: "senryo",
  version: "0.1.0",
  bundleId: "xyz.senryo.app",
  androidPackage: "xyz.senryo.app",
} as const;

/** Passkey relying-party id and universal-link host (D-049). */
export const RP_ID = "senryo.xyz";

export const ASSOCIATED_DOMAINS = [`webcredentials:${RP_ID}`, `applinks:${RP_ID}`] as const;

/** PRF passkeys need iOS 18+ / Android 9 (API 28)+ (platforms-and-stores §2). */
export const IOS_DEPLOYMENT_TARGET = "18.0";
export const ANDROID_MIN_SDK = 28;
export const ANDROID_BUILD_ARCHS = ["arm64-v8a"] as const;

/** Shown by iOS when SecureStore reads a biometric-gated item (the per-trade Face ID gate, D-028/D-037). */
export const FACE_ID_PERMISSION = "Senryo uses Face ID to unlock your account and confirm trades.";

/** Width (pt) of the seal on the splash plate; the plate colour is the D2 ground from `@senryo/tokens`. */
export const SPLASH_IMAGE_WIDTH = 96;
