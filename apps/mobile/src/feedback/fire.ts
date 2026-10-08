import { STORAGE_KEYS, storage } from "~/lib/storage";
import { type HapticEvent, playHaptic } from "./haptics";
import { playSound, type SoundName } from "./sound";
import { playCue, playProfitStep, type TradeCue } from "./trade-sound";

export type { HapticEvent } from "./haptics";
export type { SoundName } from "./sound";
export type { TradeCue } from "./trade-sound";

/**
 * The one call site for feedback (the plan's feedback map, §2.5): a haptic word, optionally paired with a sound.
 * Both respect the user's Settings → Preferences toggles (default on, persisted in MMKV).
 *
 *   fire("tick")                          keypad digit, chip, segmented control
 *   fire("filled", { cue: "open" })       a call filled (the terminal's cues, Tradash's map)
 *   fire("win", { cue: "win" })           a call won; fire("loss", { cue: "loss" }) lost
 *   fire("move", { profit: 3 })           one favourable step of an open call (the profit ladder)
 *   fire("filled", { sound: "deposit" })  dollars arrived
 */

export function hapticsEnabled(): boolean {
  return storage.getBoolean(STORAGE_KEYS.haptics) ?? true;
}

export function soundsEnabled(): boolean {
  return storage.getBoolean(STORAGE_KEYS.sounds) ?? true;
}

export function fire(event: HapticEvent, options: { sound?: SoundName; cue?: TradeCue; profit?: number } = {}): void {
  if (hapticsEnabled()) playHaptic(event);
  if (!soundsEnabled()) return;
  if (options.sound) playSound(options.sound);
  if (options.cue) playCue(options.cue);
  if (options.profit !== undefined) playProfitStep(options.profit);
}
