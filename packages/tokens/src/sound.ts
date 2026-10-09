/**
 * The terminal's sound cues, one definition for both apps: Tradash's cue map re-synthesised to the pitch contours and
 * lengths measured from its clips (canton-season3 context/13-revamp/tradash/SOUND-analysis.txt), with Owarine's synth
 * voices (5 ms exponential attack, exponential decay to silence, exponential pitch glides). The phone renders them to
 * WAV (`apps/mobile/scripts/gen-trade-sounds.mjs`); the web plays them live through Web Audio
 * (`apps/web/src/lib/feedback/sound.ts`). Our own audio — nothing of theirs ships.
 */

export type SoundCue = "tap" | "open" | "close" | "win" | "loss" | "profit" | "adverse" | "slump" | "surge" | "mega";

export interface Voice {
  type: "sine" | "triangle";
  /** Start and end pitch in Hz (an exponential glide when they differ). */
  from: number;
  to: number;
  /** Start offset and length in seconds. */
  at: number;
  dur: number;
  /** Voice level inside its cue, 0–1. */
  gain: number;
}

export const SOUND_ATTACK_S = 0.005;
/** The envelope's silence floor (exponential ramps cannot reach zero). */
export const SOUND_FLOOR = 1e-4;

/** C5 E5 G5 C6 (+E6 for mega), 45 ms apart, triangle. */
const ARPEGGIO = [523.25, 659.25, 783.99, 1046.5];
const MEGA_TOP = 1318.51;
const ARP_GAP_S = 0.045;
const ARP_DUR_S = 0.12;
const ARP_GAIN = 0.8;
const arpeggio = (notes: readonly number[]): Voice[] =>
  notes.map((f, i) => ({ type: "triangle", from: f, to: f, at: ARP_GAP_S * i, dur: ARP_DUR_S, gain: ARP_GAIN }));

export const SOUND_CUES: Record<SoundCue, readonly Voice[]> = {
  tap: [
    { type: "sine", from: 1100, to: 1100, at: 0, dur: 0.045, gain: 0.9 },
    { type: "sine", from: 2200, to: 2200, at: 0, dur: 0.03, gain: 0.3 },
  ],
  open: [{ type: "sine", from: 735, to: 1160, at: 0, dur: 0.22, gain: 0.9 }],
  close: [{ type: "sine", from: 817, to: 432, at: 0, dur: 0.24, gain: 0.9 }],
  win: [
    { type: "sine", from: 880, to: 880, at: 0, dur: 0.11, gain: 0.85 },
    { type: "sine", from: 1102, to: 1102, at: 0.08, dur: 0.11, gain: 0.8 },
    { type: "sine", from: 1297, to: 1297, at: 0.16, dur: 0.16, gain: 0.9 },
  ],
  loss: [
    { type: "sine", from: 848, to: 566, at: 0, dur: 0.42, gain: 0.75 },
    { type: "sine", from: 424, to: 283, at: 0, dur: 0.42, gain: 0.2 },
  ],
  profit: [
    { type: "sine", from: 1050, to: 1050, at: 0, dur: 0.07, gain: 0.75 },
    { type: "sine", from: 1297, to: 1297, at: 0.04, dur: 0.1, gain: 0.7 },
  ],
  adverse: [{ type: "sine", from: 262, to: 196, at: 0, dur: 0.11, gain: 0.9 }],
  slump: [{ type: "sine", from: 330, to: 130, at: 0, dur: 0.28, gain: 0.9 }],
  surge: arpeggio(ARPEGGIO),
  mega: arpeggio([...ARPEGGIO, MEGA_TOP]),
};

/** The reference mix: each cue's level under the app's master. */
export const SOUND_MIX: Record<SoundCue, number> = {
  tap: 0.3,
  open: 0.55,
  close: 0.55,
  win: 0.5,
  loss: 0.4,
  profit: 0.35,
  adverse: 0.07,
  slump: 0.14,
  surge: 0.13,
  mega: 0.16,
};
export const SOUND_MASTER = 0.7;

/** The combo ladder: a major pentatonic over two octaves, one step up per favourable move. */
export const SOUND_LADDER_SEMITONES = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24] as const;
export const SEMITONES_PER_OCTAVE = 12;
