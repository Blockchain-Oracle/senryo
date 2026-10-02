/**
 * The runtime-0.2.0 natives the money flows use — the camera (Scan) and the in-app browser (Ramp's hosted page) —
 * required lazily, only when the running binary has them (the `lib/native-modules.ts` pattern), so an older dev client
 * still loads today's bundle and the screen says plainly that this build can't scan or open the page yet.
 */
import { requireOptionalNativeModule } from "expo";
import type * as ExpoCamera from "expo-camera";
import type * as ExpoWebBrowser from "expo-web-browser";

export type CameraModule = typeof ExpoCamera;
export type WebBrowserModule = typeof ExpoWebBrowser;

let camera: CameraModule | null | undefined;
let browser: WebBrowserModule | null | undefined;

export function cameraModule(): CameraModule | undefined {
  if (camera === undefined) {
    camera = requireOptionalNativeModule("ExpoCamera") ? (require("expo-camera") as CameraModule) : null;
  }
  return camera ?? undefined;
}

export function webBrowserModule(): WebBrowserModule | undefined {
  if (browser === undefined) {
    browser = requireOptionalNativeModule("ExpoWebBrowser") ? (require("expo-web-browser") as WebBrowserModule) : null;
  }
  return browser ?? undefined;
}
