/**
 * Haptics on the web (Owarine `lib/haptics.ts` via Mitoshi): `navigator.vibrate` where it exists; on iPhone and iPad a
 * hidden native switch is clicked 1–5 times 70 ms apart. Gated by the Sound & vibration setting; silent elsewhere.
 */
import { type HapticEvent, IOS_CLICK_GAP_MS, IOS_CLICKS, VIBRATE } from "./constants";

let enabled = true;
let iosSwitch: HTMLInputElement | null = null;

function isAppleTouch(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Mount once; pre-builds the iOS switch so the first haptic is not late. */
export function installHaptics(isEnabled: boolean): void {
  enabled = isEnabled;
  if (typeof document === "undefined" || iosSwitch || !isAppleTouch() || typeof navigator.vibrate === "function")
    return;
  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  label.className = "haptic-switch";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  iosSwitch = input;
}

export function setHapticsEnabled(next: boolean): void {
  enabled = next;
}

export function haptic(event: HapticEvent): void {
  if (!enabled || typeof navigator === "undefined") return;
  try {
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(VIBRATE[event]);
      return;
    }
    const input = iosSwitch;
    if (!input) return;
    for (let i = 0; i < IOS_CLICKS[event]; i++) setTimeout(() => input.click(), i * IOS_CLICK_GAP_MS);
  } catch {
    // No haptics here.
  }
}
