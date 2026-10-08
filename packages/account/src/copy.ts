/**
 * User copy for auth failures and scope refusals, shared by web and mobile. Plain words (ux-product-feel B.11): say
 * "Face ID" on iOS, "fingerprint or screen lock" on Android, "passkey" on web; never PRF, seed or wallet up front.
 */
import type { AuthFailure } from "./errors.ts";
import type { RejectReason } from "./policy/types.ts";

export type Surface = "ios" | "android" | "web";

export interface Copy {
  title: string;
  body: string;
}

export function biometricWord(surface: Surface): string {
  if (surface === "ios") return "Face ID";
  if (surface === "android") return "fingerprint or screen lock";
  return "passkey";
}

const UNKNOWN_TITLE: Record<Surface, string> = { ios: "Face ID", android: "Fingerprint", web: "Passkey" };

export function authFailureCopy(kind: AuthFailure, surface: Surface): Copy {
  switch (kind) {
    case "cancelled":
      return { title: "Cancelled", body: "Nothing changed." };
    case "prf-unavailable":
      return {
        title: "This passkey provider can't hold a Senryo account",
        body:
          surface === "web"
            ? "Save the passkey to iCloud Keychain, Google Password Manager or 1Password. Chrome's local profile, Bitwarden and Dashlane don't support it yet."
            : "iOS needs version 18 or newer; on Android, Google Password Manager and 1Password both work.",
      };
    case "no-credentials":
      return {
        title: "No Senryo passkey on this device",
        body: "Create an account, or check that your passkey synced here (iCloud Keychain, Google Password Manager or 1Password).",
      };
    case "no-create-option":
      return {
        title: "No passkey provider is set up",
        body: "Passkeys need a screen lock (PIN, pattern or passcode) and a passkey provider: add a Google account in Settings (or turn on 1Password for passkeys), then try again.",
      };
    case "bad-configuration":
      return {
        title: "Account setup unavailable",
        body: "This app couldn't connect to Senryo's account setup. Continue at senryo.xyz with the same account.",
      };
    case "not-supported":
      return {
        title: "Passkeys aren't available here",
        body: "Senryo needs iOS 18+, Android 9+, or a current Chrome, Safari or Firefox, and a screen lock on the phone (PIN, pattern or passcode). No Face ID or fingerprint needed.",
      };
    case "insecure-context":
      return { title: "Open Senryo over HTTPS", body: "Passkeys only work on a secure connection." };
    case "wrong-account":
      return {
        title: "That passkey opens a different account",
        body: "Pick the Senryo passkey you signed in with. Nothing was signed.",
      };
    case "invalidated":
      return {
        title: `${surface === "ios" ? "Face ID" : "Biometrics"} changed on this device`,
        body: "For safety, confirm once with your passkey to unlock trading again.",
      };
    case "timed-out":
      return { title: "That took too long", body: "Try again when you're ready." };
    case "interrupted":
      return { title: "Interrupted", body: "Try again." };
    case "host-not-allowed":
      return {
        title: "This address can't hold Senryo accounts",
        body: "Open senryo.xyz — passkeys belong to that domain, so any other host would create a different account.",
      };
    case "unknown":
      return { title: `${UNKNOWN_TITLE[surface]} didn't work`, body: "Try again, or use your device passcode." };
  }
}

export function scopeCopy(reason: RejectReason): Copy {
  switch (reason) {
    case "rate":
      return { title: "Lots of calls in a minute", body: "Confirm this one with Face ID." };
    case "send":
    case "value":
      return { title: "Sending money out", body: "Sends to other addresses always ask for Face ID." };
    case "approve":
      return { title: "Allow spending", body: "Letting a contract spend your dollars always asks for Face ID." };
    case "context-unavailable":
      return { title: "Balances are still loading", body: "Confirm with Face ID, or wait a moment." };
    default:
      return { title: "Needs a fresh check", body: "This action is outside your one-tap session." };
  }
}
