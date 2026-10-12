import type { LadderCue, SongName, SoundCue } from "@senryo/tokens";

/**
 * What a run sounds and feels like, from the app that plays it (D-317): the web's Web Audio and vibration, the phone's
 * expo-audio and haptics. The same words on both (`fire`, `sound`, `music`), so a run calls them the same way.
 */
export type FeelEvent = "tick" | "press" | "snap" | "confirm" | "impact" | "fail" | "surge" | "win";

export interface ArcadeFeel {
  fire(event: FeelEvent, options?: { cue?: SoundCue; ladder?: readonly [LadderCue, number] }): void;
  sound(cue: SoundCue): void;
  music(song: SongName | null): void;
}
