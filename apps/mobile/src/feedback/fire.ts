import type { LadderCue, SongName, SoundCue } from "@senryo/tokens";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { playCue, playLadder, setEffectsVolume } from "./cues";
import { type HapticEvent, playHaptic } from "./haptics";
import { duckMusic, setMusic, setMusicTense, setMusicVolume } from "./music";
import { playSound, type SoundName } from "./sound";

export type { HapticEvent } from "./haptics";
export type { SoundName } from "./sound";

/**
 * The one call site for feedback (D-317, F1–F3; the web's `fire`): a haptic word, optionally with a cue from the shared
 * map, a climbing cue's step, the profit ladder or a UI sound. All respect Settings → Sound & vibration (sound and
 * haptics on by default, the effects and music volumes; persisted in MMKV).
 *
 *   fire("tick")                                   keypad digit, chip, segmented control
 *   fire("filled", { cue: "open" })                a call filled
 *   fire("win", { cue: "win" })                    a call won; fire("loss", { cue: "loss" }) lost
 *   fire("move", { profit: 3 })                    one favourable step of an open call (the profit ladder)
 *   fire("tick", { ladder: ["reelLock", 1] })      a climbing cue at its step
 *   fire("filled", { sound: "deposit" })           dollars arrived
 *   music("games") / music(null)                   a song plays (crossfading) / stops
 */

/** Cues that are verdicts: the music ducks under them. */
const VERDICTS: ReadonlySet<SoundCue> = new Set(["win", "loss", "refund", "verdict", "jackpot", "crash", "matchFound"]);
const DEFAULT_MUSIC_VOLUME = 0.6;

export function hapticsEnabled(): boolean {
  return storage.getBoolean(STORAGE_KEYS.haptics) ?? true;
}

export function soundsEnabled(): boolean {
  return storage.getBoolean(STORAGE_KEYS.sounds) ?? true;
}

export function effectsVolume(): number {
  return storage.getNumber(STORAGE_KEYS.effectsVolume) ?? 1;
}

export function musicVolume(): number {
  return storage.getNumber(STORAGE_KEYS.musicVolume) ?? DEFAULT_MUSIC_VOLUME;
}

/** Apply the stored volumes to the players (at launch and after the sheet changes them). */
export function applyVolumes(): void {
  setEffectsVolume(effectsVolume());
  setMusicVolume(musicVolume());
}

export function fire(
  event: HapticEvent,
  options: { sound?: SoundName; cue?: SoundCue; profit?: number; ladder?: readonly [LadderCue, number] } = {},
): void {
  if (hapticsEnabled()) playHaptic(event);
  if (!soundsEnabled()) return;
  if (options.sound) playSound(options.sound);
  if (options.cue) {
    if (VERDICTS.has(options.cue)) duckMusic();
    playCue(options.cue);
  }
  if (options.profit !== undefined) playLadder("profit", options.profit);
  if (options.ladder) playLadder(options.ladder[0], options.ladder[1]);
}

/** Play a song (crossfading) or stop with null; silent with sound off. */
export function music(song: SongName | null): void {
  setMusic(soundsEnabled() ? song : null);
}

/** The tense twin while an open call is down 5 % or more. */
export function musicTense(tense: boolean): void {
  setMusicTense(tense);
}
