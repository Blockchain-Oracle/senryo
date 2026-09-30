import type { ConfigContext, ExpoConfig } from "expo/config";
import { DARK } from "../../packages/tokens/src/palette.ts";
import {
  ANDROID_BUILD_ARCHS,
  ANDROID_MIN_SDK,
  APP,
  ASSOCIATED_DOMAINS,
  FACE_ID_PERMISSION,
  IOS_DEPLOYMENT_TARGET,
  RP_ID,
  SPLASH_IMAGE_WIDTH,
} from "./src/lib/constants/app.ts";

/**
 * Senryo mobile (Expo SDK 57 dev build — Expo Go is unsupported: passkeys and biometric SecureStore need native code).
 * EAS project id / owner are added by `eas init` on the user's account (S5 user step), never hard-coded here.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP.name,
  slug: APP.slug,
  version: APP.version,
  scheme: APP.scheme,
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/images/icon.png",
  backgroundColor: DARK.background,
  ios: {
    bundleIdentifier: APP.bundleId,
    supportsTablet: false,
    associatedDomains: [...ASSOCIATED_DOMAINS],
    config: { usesNonExemptEncryption: false },
    infoPlist: { NSSupportsLiveActivities: true },
  },
  android: {
    package: APP.androidPackage,
    adaptiveIcon: {
      backgroundColor: DARK.background,
      foregroundImage: "./assets/images/android-icon-foreground.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: RP_ID }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  plugins: [
    "expo-router",
    "expo-dev-client",
    "expo-font",
    [
      "expo-splash-screen",
      { backgroundColor: DARK.background, image: "./assets/images/splash-icon.png", imageWidth: SPLASH_IMAGE_WIDTH },
    ],
    ["expo-secure-store", { faceIDPermission: FACE_ID_PERMISSION }],
    [
      "expo-build-properties",
      {
        ios: { deploymentTarget: IOS_DEPLOYMENT_TARGET },
        android: { minSdkVersion: ANDROID_MIN_SDK, buildArchs: [...ANDROID_BUILD_ARCHS] },
      },
    ],
    ["expo-audio", { microphonePermission: false }],
    "react-native-quick-crypto",
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  runtimeVersion: { policy: "appVersion" },
  extra: { rpId: RP_ID },
});
