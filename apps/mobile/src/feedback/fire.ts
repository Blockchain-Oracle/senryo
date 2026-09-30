import { STORAGE_KEYS, storage } from "~/lib/storage";
import { type HapticEvent, playHaptic } from "./haptics";
import { playSound, type SoundName } from "./sound";

export type { HapticEvent } from "./haptics";
export type { SoundName } from "./sound";

/**
 * The one call site for feedback (the plan's feedback map, §2.5): a haptic word, optionally paired with a sound.
 * Both respect the user's Settings → Preferences toggles (default on, persisted in MMKV).
 *
 *   fire("tick")                        keypad digit, chip, segmented control
 *   fire("filled", { sound: "fill" })   order filled
 *   fire("filled", { sound: "deposit" }) deposit credited
 *   fire("liquidation")                 liquidation (haptic + liquidation sound by default)
 */
const DEFAULT_SOUND: Partial<Record<HapticEvent, SoundName>> = { liquidation: "liquidation" };

export function hapticsEnabled(): boolean {
  return storage.getBoolean(STORAGE_KEYS.haptics) ?? true;
}

export function soundsEnabled(): boolean {
  return storage.getBoolean(STORAGE_KEYS.sounds) ?? true;
}

export function fire(event: HapticEvent, options: { sound?: SoundName } = {}): void {
  if (hapticsEnabled()) playHaptic(event);
  const sound = options.sound ?? DEFAULT_SOUND[event];
  if (sound && soundsEnabled()) playSound(sound);
}
