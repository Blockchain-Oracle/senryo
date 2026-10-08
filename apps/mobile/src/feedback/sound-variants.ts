/**
 * The ElevenLabs-generated alternatives for every cue (assets/sounds/variants, provenance in assets/sounds/README.md),
 * for choosing by ear in Preferences → Sounds. Static requires (Metro bundles only what is required). The chosen
 * variant per cue is a per-device preference; the default is the bundled `<cue>.wav`.
 */
import type { AudioSource } from "expo-audio";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import type { SoundName } from "./sound";

export const SOUND_VARIANTS: Readonly<Record<SoundName, readonly AudioSource[]>> = {
  scene: [
    require("../../assets/sounds/variants/scene_v1.wav"),
    require("../../assets/sounds/variants/scene_v2.wav"),
    require("../../assets/sounds/variants/scene_v3.wav"),
  ],
  onboarding: [
    require("../../assets/sounds/variants/onboarding_v1.wav"),
    require("../../assets/sounds/variants/onboarding_v2.wav"),
    require("../../assets/sounds/variants/onboarding_v3.wav"),
  ],
  deposit: [
    require("../../assets/sounds/variants/deposit_v1.wav"),
    require("../../assets/sounds/variants/deposit_v2.wav"),
    require("../../assets/sounds/variants/deposit_v3.wav"),
  ],
  send: [
    require("../../assets/sounds/variants/send_v1.wav"),
    require("../../assets/sounds/variants/send_v2.wav"),
    require("../../assets/sounds/variants/send_v3.wav"),
  ],
  unlock: [
    require("../../assets/sounds/variants/unlock_v1.wav"),
    require("../../assets/sounds/variants/unlock_v2.wav"),
    require("../../assets/sounds/variants/unlock_v3.wav"),
  ],
  error: [
    require("../../assets/sounds/variants/error_v1.wav"),
    require("../../assets/sounds/variants/error_v2.wav"),
    require("../../assets/sounds/variants/error_v3.wav"),
  ],
};

/** Chosen variant index per cue (0-based), or undefined for the default file. */
export function chosenVariant(name: SoundName): number | undefined {
  const raw = storage.getString(STORAGE_KEYS.soundChoice);
  if (!raw) return undefined;
  try {
    const value = (JSON.parse(raw) as Partial<Record<SoundName, number>>)[name];
    return typeof value === "number" && SOUND_VARIANTS[name][value] ? value : undefined;
  } catch {
    return undefined;
  }
}

export function chooseVariant(name: SoundName, index: number | undefined): void {
  let current: Partial<Record<SoundName, number>> = {};
  try {
    current = JSON.parse(storage.getString(STORAGE_KEYS.soundChoice) ?? "{}");
  } catch {
    current = {};
  }
  if (index === undefined) delete current[name];
  else current[name] = index;
  storage.set(STORAGE_KEYS.soundChoice, JSON.stringify(current));
}
