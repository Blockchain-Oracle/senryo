import type { ConfigContext, ExpoConfig } from "expo/config";
import { DARK } from "../../packages/tokens/src/palette.ts";
import {
  ANDROID_BUILD_ARCHS,
  ANDROID_MIN_SDK,
  APP,
  APPLE_TEAM_ID,
  ASSOCIATED_DOMAINS,
  EAS,
  FACE_ID_PERMISSION,
  IOS_DEPLOYMENT_TARGET,
  RP_ID,
  SPLASH_IMAGE_WIDTH,
} from "./src/lib/constants/app.ts";

/**
 * Senryo mobile (Expo SDK 57 dev build — Expo Go is unsupported: passkeys and biometric SecureStore need native code).
 * EAS project id / owner come from `eas init` on the user's account (S5 user step); `eas init` can't write a dynamic
 * config, so they live in `src/lib/constants/app.ts`.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP.name,
  slug: APP.slug,
  owner: EAS.owner,
  version: APP.version,
  scheme: APP.scheme,
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/images/icon.png",
  backgroundColor: DARK.background,
  ios: {
    bundleIdentifier: APP.bundleId,
    // Without a team, a local build identifies itself as FAKETEAMID.<bundle id>: the association file can't match it,
    // so passkeys fail with "not linked to senryo.xyz" and the Keychain is unavailable.
    appleTeamId: APPLE_TEAM_ID,
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
  extra: { rpId: RP_ID, eas: { projectId: EAS.projectId } },
});
