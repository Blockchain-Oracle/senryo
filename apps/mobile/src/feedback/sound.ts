import { type AudioPlayer, type AudioSource, createAudioPlayer, setAudioModeAsync } from "expo-audio";

/**
 * The UI sound palette (plan §2.4): fill, deposit, send, unlock, liquidation; error is optional and off by default.
 * Ported from the pre-existing audio pool: app-lifetime players preloaded once, replayed with seekTo(0) + play(),
 * errors swallowed. Sounds follow the ringer switch (`playsInSilentMode: false`) and mix with other audio.
 * No sound for ticks or navigation — haptics own those.
 */
export type SoundName = "fill" | "deposit" | "send" | "unlock" | "liquidation" | "error";

/**
 * Sources land with the S1 sound pass (ElevenLabs, [OK?] credits); until then every name is a silent no-op.
 * Add a file as `fill: require("../../assets/sounds/fill.mp3")`.
 */
const SOURCES: Partial<Record<SoundName, AudioSource>> = {};

/** Per-sound gain, levelled so the palette sits together (ported volumes). */
const VOLUME: Record<SoundName, number> = {
  fill: 0.6,
  deposit: 0.55,
  send: 0.4,
  unlock: 0.35,
  liquidation: 0.7,
  error: 0.4,
};

const players = new Map<SoundName, AudioPlayer>();
let prepared = false;

/** Once at launch (the root layout's FeedbackHost): audio mode, then one player per available sound. */
export async function prepareSounds(): Promise<void> {
  if (prepared) return;
  prepared = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers" });
  } catch {
    // Audio session refused (another app holds it exclusively): sounds stay silent, haptics still play.
  }
  for (const [name, source] of Object.entries(SOURCES) as [SoundName, AudioSource][]) {
    const player = createAudioPlayer(source);
    player.volume = VOLUME[name];
    players.set(name, player);
  }
}

export function playSound(name: SoundName): void {
  const player = players.get(name);
  if (!player) return;
  try {
    void player.seekTo(0);
    player.play();
  } catch {
    // A failed UI sound never interrupts the action it decorates.
  }
}

export function releaseSounds(): void {
  for (const player of players.values()) player.remove();
  players.clear();
  prepared = false;
}
