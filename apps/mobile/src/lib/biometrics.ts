/**
 * The phone's biometric gate for the Face ID primer (J1, FT042/C06). Unlocking trading already reads a
 * biometric-gated item (`secret-store.native.ts`), so turning Face ID on here means asking iOS for Senryo's Face ID
 * permission in context and doing one real scan; it never stands in for a passkey ceremony. Without the permission,
 * unlocking falls back to the passkey.
 */
import { Platform } from "react-native";
import { countingPrompts } from "~/lib/account/system-prompt";
import { localAuthModule } from "~/lib/native-modules";

/**
 * `ready`: hardware and an enrolled face or finger. `unavailable`: no biometric hardware. `old-build`: this binary
 * predates the module — the phone may well have Face ID, and unlocking still uses it; only this primer can't ask.
 */
export type BiometricState = "ready" | "not-enrolled" | "unavailable" | "old-build";
export type BiometricOutcome = "on" | "cancelled" | "denied" | "locked-out" | "failed";

export interface Biometrics {
  state: BiometricState;
  /** "Face ID", "Touch ID" or "fingerprint", as this phone has it. */
  word: string;
}

export async function readBiometrics(): Promise<Biometrics> {
  const auth = localAuthModule();
  const fallbackWord = Platform.OS === "ios" ? "Face ID" : "fingerprint";
  if (!auth) return { state: "old-build", word: fallbackWord };
  const [hardware, enrolled, types] = await Promise.all([
    auth.hasHardwareAsync(),
    auth.isEnrolledAsync(),
    auth.supportedAuthenticationTypesAsync(),
  ]);
  const face = types.includes(auth.AuthenticationType.FACIAL_RECOGNITION);
  const word = Platform.OS !== "ios" ? "fingerprint" : face || types.length === 0 ? "Face ID" : "Touch ID";
  if (!hardware) return { state: "unavailable", word };
  return { state: enrolled ? "ready" : "not-enrolled", word };
}

/** One scan behind iOS's permission prompt (asked the first time only). Never throws. */
export async function turnOnBiometrics(prompt: string): Promise<BiometricOutcome> {
  const auth = localAuthModule();
  if (!auth) return "failed";
  try {
    const result = await countingPrompts(auth).authenticateAsync({
      promptMessage: prompt,
      cancelLabel: "Not now",
      disableDeviceFallback: true,
    });
    if (result.success) return "on";
    switch (result.error) {
      case "user_cancel":
      case "system_cancel":
      case "app_cancel":
      case "user_fallback":
        return "cancelled";
      // iOS reports a refused permission as biometrics being unavailable to this app.
      case "not_available":
      case "not_enrolled":
        return "denied";
      case "lockout":
        return "locked-out";
      default:
        return "failed";
    }
  } catch {
    return "failed";
  }
}
