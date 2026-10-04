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
/** EAS profiles whose iOS builds are distribution-signed and therefore use production APNs. */
const APNS_PRODUCTION_PROFILES = new Set(["production", "preview"]);
/** Shown by iOS when Send opens the scanner. */
const CAMERA_PERMISSION = "Senryo uses the camera to scan wallet and payment QR codes.";

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
    // Firebase config for FCM (Android push through Expo): EAS injects it as the secret file variable
    // GOOGLE_SERVICES_JSON (Firebase project senryo-app-xyz); a local prebuild without it simply has no FCM.
    ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}),
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
    ["expo-local-authentication", { faceIDPermission: FACE_ID_PERMISSION }],
    // APNs environment: store and ad-hoc (preview) builds are signed for production APNs; dev clients and local
    // builds use the sandbox. A preview build on the sandbox environment would silently never receive a push.
    [
      "expo-notifications",
      { mode: APNS_PRODUCTION_PROFILES.has(process.env.EAS_BUILD_PROFILE ?? "") ? "production" : "development" },
    ],
    [
      "expo-build-properties",
      {
        ios: {
          deploymentTarget: IOS_DEPLOYMENT_TARGET,
          extraPods: [{ name: "Ramp", git: "https://github.com/RampNetwork/ramp-sdk-ios.git", tag: "4.0.1" }],
        },
        android: {
          minSdkVersion: ANDROID_MIN_SDK,
          buildArchs: [...ANDROID_BUILD_ARCHS],
          extraMavenRepos: ["https://jitpack.io"],
        },
      },
    ],
    ["expo-audio", { microphonePermission: false }],
    "react-native-quick-crypto",
    // Runtime 0.2.0 natives (Part E5): image prefetch for the welcome story, QR scanning in Send, hosted provider pages
    // (Ramp, Lithic), and sharing trade / receipt cards.
    "expo-image",
    "expo-web-browser",
    "expo-sharing",
    ["expo-camera", { cameraPermission: CAMERA_PERMISSION, microphonePermission: false, recordAudioAndroid: false }],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  runtimeVersion: { policy: "appVersion" },
  // EAS Update: a store or TestFlight build on channel `production` / `preview` (eas.json) takes JS-only fixes over
  // the air for the same app version; a native change still needs a new build.
  updates: { url: `https://u.expo.dev/${EAS.projectId}` },
  extra: { rpId: RP_ID, eas: { projectId: EAS.projectId } },
});
