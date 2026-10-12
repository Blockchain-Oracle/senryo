/**
 * Every cue on the phone (D-317, F1): the shared cue map (`@senryo/tokens` `sound.ts`) rendered to WAV by
 * `scripts/gen-sounds.mjs` — the same voices the web synthesises live — with each climbing cue's ladder as one file a
 * step. Two players per sound so a quick repeat overlaps; levels are the reference mix under the effects volume.
 * Players load on first use; every failure is swallowed — a sound never breaks a call.
 */
import { type LadderCue, SOUND_LADDERS, SOUND_MASTER, SOUND_MIX, type SoundCue } from "@senryo/tokens";
import { type AudioPlayer, type AudioSource, createAudioPlayer } from "expo-audio";
import { AppState } from "react-native";
import { CUE_SOURCES, LADDER_SOURCES } from "./cue-sources";
import { playSound } from "./sound";

const POOL = 2;
const pools = new Map<string, { players: AudioPlayer[]; next: number }>();
let effectsVolume = 1;

function play(key: string, source: AudioSource, gain: number): void {
  if (AppState.currentState !== "active") return;
  try {
    let entry = pools.get(key);
    if (!entry) {
      entry = { players: Array.from({ length: POOL }, () => createAudioPlayer(source)), next: 0 };
      pools.set(key, entry);
    }
    const player = entry.players[entry.next % POOL];
    entry.next += 1;
    if (!player) return;
    player.volume = SOUND_MASTER * gain * effectsVolume;
    void player.seekTo(0).then(() => player.play());
  } catch {
    // Audio is decoration; the call it accompanies never depends on it.
  }
}

const isLadder = (cue: SoundCue): cue is LadderCue => cue in SOUND_LADDERS;

export function playCue(cue: SoundCue): void {
  if (isLadder(cue)) {
    playLadder(cue, 0);
    return;
  }
  // The phone's error is the one picked by ear in Sound settings (the UI palette), not a second error sound.
  if (cue === "error") {
    void playSound("error");
    return;
  }
  play(cue, CUE_SOURCES[cue], SOUND_MIX[cue]);
}

/** A climbing cue at its ladder's step (clamped): the profit ladder, Lucky's reels, a streak's gaps… */
export function playLadder(cue: LadderCue, step: number): void {
  const steps = LADDER_SOURCES[cue];
  const i = Math.max(0, Math.min(steps.length - 1, Math.floor(step)));
  const source = steps[i];
  if (source) play(`${cue}-${i}`, source, SOUND_MIX[cue]);
}

export function setEffectsVolume(volume: number): void {
  effectsVolume = volume;
}

export function releaseCues(): void {
  for (const entry of pools.values()) for (const p of entry.players) p.remove();
  pools.clear();
}
