import { type AudioPlayer, type AudioSource, createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { AppState } from "react-native";
import { SOUND_VOLUME } from "./constants";
import { chosenVariant, SOUND_VARIANTS } from "./sound-variants";

/**
 * The UI sound palette (plan §2.4): fill, deposit, send, unlock, liquidation; error is optional and off by default.
 * Ported from the pre-existing audio pool: app-lifetime players preloaded once, replayed with seekTo(0) + play(),
 * errors swallowed. Sounds follow the ringer switch (`playsInSilentMode: false`) and mix with other audio.
 * No sound for ticks or navigation — haptics own those.
 */
export type SoundName = "scene" | "onboarding" | "fill" | "deposit" | "send" | "unlock" | "liquidation" | "error";

/** Original cues generated with ElevenLabs, trimmed and level-matched (assets/sounds/README.md). */
const SOURCES: Record<SoundName, AudioSource> = {
  scene: require("../../assets/sounds/scene.wav"),
  onboarding: require("../../assets/sounds/onboarding.wav"),
  fill: require("../../assets/sounds/fill.wav"),
  deposit: require("../../assets/sounds/deposit.wav"),
  send: require("../../assets/sounds/send.wav"),
  unlock: require("../../assets/sounds/unlock.wav"),
  liquidation: require("../../assets/sounds/liquidation.wav"),
  error: require("../../assets/sounds/error.wav"),
};

/** The cue's source: the variant chosen in Preferences, else the default file. */
function sourceOf(name: SoundName): AudioSource {
  const chosen = chosenVariant(name);
  return chosen === undefined ? SOURCES[name] : (SOUND_VARIANTS[name][chosen] ?? SOURCES[name]);
}

const players = new Map<SoundName, AudioPlayer>();
let prepared = false;

/** Once at launch (the root layout's FeedbackHost): audio mode, then one player per available sound. */
export async function prepareSounds(): Promise<void> {
  if (prepared) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: false,
      interruptionMode: "mixWithOthers",
      shouldPlayInBackground: false,
    });
  } catch {
    // Sound failure cannot affect the financial action. A later mount can retry.
    return;
  }
  prepared = true;
  for (const name of Object.keys(SOURCES) as SoundName[]) {
    try {
      const player = createAudioPlayer(sourceOf(name));
      player.volume = SOUND_VOLUME[name];
      players.set(name, player);
    } catch {
      /* Audio is optional; a failed player cannot break app launch. */
    }
  }
}

export async function playSound(name: SoundName): Promise<void> {
  const player = players.get(name);
  if (!player || AppState.currentState !== "active") return;
  try {
    await player.seekTo(0);
    if (AppState.currentState === "active") player.play();
  } catch {
    // A failed UI sound never interrupts the action it decorates.
  }
}

/** Swap one cue to a newly chosen variant without restarting the app. */
export function reloadSound(name: SoundName): void {
  if (!prepared) return;
  players.get(name)?.remove();
  try {
    const player = createAudioPlayer(sourceOf(name));
    player.volume = SOUND_VOLUME[name];
    players.set(name, player);
  } catch {
    players.delete(name);
  }
}

/** Plays a candidate once at its cue's level (Preferences preview); the player is released when it finishes. */
export function previewSound(name: SoundName, source: AudioSource): void {
  try {
    const player = createAudioPlayer(source);
    player.volume = SOUND_VOLUME[name];
    const done = player.addListener("playbackStatusUpdate", (status) => {
      if (status.didJustFinish) {
        done.remove();
        player.remove();
      }
    });
    player.play();
  } catch {
    // A preview that can't play is silent; nothing else depends on it.
  }
}

export function releaseSounds(): void {
  for (const player of players.values()) player.remove();
  players.clear();
  prepared = false;
}
