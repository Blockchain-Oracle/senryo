/**
 * Every sound cue, one definition for both apps (D-317, F1): Tradash's trading cues re-synthesised to the pitch contours
 * and lengths measured from its clips (canton-season3 context/13-revamp/tradash/SOUND-analysis.txt), and the UI, game,
 * Duel and event cues re-written from Owarine's synths (`web/src/features/games/{arcade/arcade-sfx,lucky/reel-sfx}.ts`,
 * `lib/sound/trade.ts`) in the bed's key, A minor. The phone renders them to WAV (`apps/mobile/scripts/gen-sounds.mjs`);
 * the web plays them live through Web Audio (`apps/web/src/lib/feedback/sound.ts`). Our own audio — nothing of theirs
 * ships. A voice is an oscillator or noise with a pitch glide, an envelope and an optional sweeping filter.
 */

export type SoundCue =
  // Interface
  | "tap"
  | "toggle"
  | "sheetOpen"
  | "sheetClose"
  | "success"
  | "error"
  // Trading
  | "open"
  | "close"
  | "win"
  | "loss"
  | "refund"
  | "profit"
  | "adverse"
  | "slump"
  | "surge"
  | "mega"
  // Games
  | "reelSpin"
  | "reelTick"
  | "reelLock"
  | "jackpot"
  | "nearMiss"
  | "cardDeal"
  | "cardFlip"
  | "cardSlam"
  | "countBeep"
  | "countGo"
  | "coin"
  | "wing"
  | "gap"
  | "comboStep"
  | "milestone"
  | "landing"
  | "scrape"
  | "crash"
  | "matchFound"
  // Events
  | "eventLock"
  | "verdict";

export type Wave = "sine" | "triangle" | "square" | "sawtooth" | "noise";

export interface VoiceFilter {
  type: "lowpass" | "highpass" | "bandpass";
  /** Cutoff at the voice's start and (an exponential sweep) its end, in Hz. */
  from: number;
  to?: number;
  q?: number;
}

export interface Voice {
  type: Wave;
  /** Start and end pitch in Hz (an exponential glide when they differ; ignored for noise). */
  from: number;
  to: number;
  /** Start offset and length in seconds. */
  at: number;
  dur: number;
  /** Voice level inside its cue, 0–1. */
  gain: number;
  /** Cents off the pitch (two detuned voices make a chorus). */
  detune?: number;
  /**
   * `pluck` (the default): a 5 ms exponential attack, then an exponential fall to silence over the voice — a cue.
   * `hold`: an 8 ms linear attack, held, released over the last 30 % — a sequenced note in the music.
   */
  env?: "pluck" | "hold";
  filter?: VoiceFilter;
}

export const SOUND_ATTACK_S = 0.005;
export const SOUND_HOLD_ATTACK_S = 0.008;
/** Where a held note starts its release, as a fraction of its length. */
export const SOUND_HOLD_RELEASE_AT = 0.7;
/** The envelope's silence floor (exponential ramps cannot reach zero). */
export const SOUND_FLOOR = 1e-4;
/** A biquad's default resonance (Butterworth). */
export const SOUND_FILTER_Q = Math.SQRT1_2;

/** C5 E5 G5 C6 (+E6 for mega), 45 ms apart, triangle. */
const ARPEGGIO = [523.25, 659.25, 783.99, 1046.5];
const MEGA_TOP = 1318.51;
const ARP_GAP_S = 0.045;
const ARP_DUR_S = 0.12;
const ARP_GAIN = 0.8;
const arpeggio = (notes: readonly number[], gap = ARP_GAP_S, dur = ARP_DUR_S): Voice[] =>
  notes.map((f, i) => ({ type: "triangle", from: f, to: f, at: gap * i, dur, gain: ARP_GAIN }));

/** A low sine falling fast: the body of a thunk, a landing, a stamp. */
const thud = (from: number, to: number, dur: number, gain: number, at = 0): Voice => ({
  type: "sine",
  from,
  to,
  at,
  dur,
  gain,
});

export const SOUND_CUES: Record<SoundCue, readonly Voice[]> = {
  tap: [
    { type: "sine", from: 1100, to: 1100, at: 0, dur: 0.045, gain: 0.9 },
    { type: "sine", from: 2200, to: 2200, at: 0, dur: 0.03, gain: 0.3 },
  ],
  toggle: [
    { type: "sine", from: 1400, to: 1400, at: 0, dur: 0.03, gain: 0.7 },
    { type: "triangle", from: 700, to: 700, at: 0.025, dur: 0.035, gain: 0.4 },
  ],
  sheetOpen: [
    { type: "sine", from: 520, to: 780, at: 0, dur: 0.11, gain: 0.6 },
    { type: "noise", from: 0, to: 0, at: 0, dur: 0.07, gain: 0.18, filter: { type: "highpass", from: 2500, to: 5000 } },
  ],
  sheetClose: [
    { type: "sine", from: 780, to: 500, at: 0, dur: 0.1, gain: 0.55 },
    { type: "noise", from: 0, to: 0, at: 0, dur: 0.06, gain: 0.14, filter: { type: "highpass", from: 5000, to: 2500 } },
  ],
  success: [
    { type: "triangle", from: 659.25, to: 659.25, at: 0, dur: 0.09, gain: 0.7 },
    { type: "triangle", from: 987.77, to: 987.77, at: 0.07, dur: 0.16, gain: 0.8 },
  ],
  error: [
    { type: "square", from: 233, to: 196, at: 0, dur: 0.16, gain: 0.45, filter: { type: "lowpass", from: 1400 } },
    { type: "square", from: 185, to: 185, at: 0.13, dur: 0.14, gain: 0.4, filter: { type: "lowpass", from: 1100 } },
  ],
  open: [{ type: "sine", from: 735, to: 1160, at: 0, dur: 0.22, gain: 0.9 }],
  close: [{ type: "sine", from: 817, to: 432, at: 0, dur: 0.24, gain: 0.9 }],
  win: [
    { type: "sine", from: 880, to: 880, at: 0, dur: 0.11, gain: 0.85 },
    { type: "sine", from: 1102, to: 1102, at: 0.08, dur: 0.11, gain: 0.8 },
    { type: "sine", from: 1297, to: 1297, at: 0.16, dur: 0.16, gain: 0.9 },
  ],
  // An octave under the first cut (research 01 E2): a loss reads as a fall, not an alarm.
  loss: [
    { type: "sine", from: 424, to: 283, at: 0, dur: 0.42, gain: 0.8 },
    { type: "sine", from: 212, to: 141, at: 0, dur: 0.42, gain: 0.3 },
  ],
  refund: [
    { type: "sine", from: 698.46, to: 698.46, at: 0, dur: 0.1, gain: 0.7 },
    { type: "sine", from: 698.46, to: 698.46, at: 0.12, dur: 0.14, gain: 0.6 },
  ],
  profit: [
    { type: "sine", from: 1050, to: 1050, at: 0, dur: 0.07, gain: 0.75 },
    { type: "sine", from: 1297, to: 1297, at: 0.04, dur: 0.1, gain: 0.7 },
  ],
  adverse: [{ type: "sine", from: 262, to: 196, at: 0, dur: 0.11, gain: 0.9 }],
  slump: [{ type: "sine", from: 330, to: 130, at: 0, dur: 0.28, gain: 0.9 }],
  surge: arpeggio(ARPEGGIO),
  mega: arpeggio([...ARPEGGIO, MEGA_TOP]),
  // Lucky's machine: a rising whoosh as the reels go, a ratchet tick, a thunk per reel climbing A–C♯–E (a ladder).
  reelSpin: [
    {
      type: "noise",
      from: 0,
      to: 0,
      at: 0,
      dur: 0.6,
      gain: 0.5,
      filter: { type: "bandpass", from: 400, to: 2400, q: 1.2 },
    },
    { type: "triangle", from: 220, to: 440, at: 0, dur: 0.5, gain: 0.25 },
  ],
  reelTick: [
    { type: "square", from: 1800, to: 1800, at: 0, dur: 0.018, gain: 0.3, filter: { type: "highpass", from: 1000 } },
  ],
  reelLock: [
    { type: "triangle", from: 440, to: 440, at: 0, dur: 0.14, gain: 0.8 },
    thud(110, 62, 0.16, 0.7),
    { type: "noise", from: 0, to: 0, at: 0, dur: 0.05, gain: 0.3, filter: { type: "lowpass", from: 900 } },
  ],
  jackpot: [
    ...arpeggio([880, 1108.73, 1318.51, 1760], 0.05, 0.16),
    { type: "sine", from: 1760, to: 1760, at: 0.2, dur: 0.7, gain: 0.35 },
    { type: "triangle", from: 2217.46, to: 2217.46, at: 0.24, dur: 0.6, gain: 0.25 },
  ],
  nearMiss: [{ type: "triangle", from: 523.25, to: 493.88, at: 0, dur: 0.32, gain: 0.7 }],
  // Cards: a flick off the deck, the flip, the slam on the table.
  cardDeal: [
    {
      type: "noise",
      from: 0,
      to: 0,
      at: 0,
      dur: 0.08,
      gain: 0.6,
      filter: { type: "bandpass", from: 2600, to: 1200, q: 1.4 },
    },
  ],
  cardFlip: [
    { type: "noise", from: 0, to: 0, at: 0, dur: 0.06, gain: 0.5, filter: { type: "highpass", from: 2000, to: 4200 } },
    { type: "triangle", from: 1200, to: 1600, at: 0.01, dur: 0.05, gain: 0.25 },
  ],
  cardSlam: [
    thud(160, 58, 0.2, 0.95),
    { type: "noise", from: 0, to: 0, at: 0, dur: 0.12, gain: 0.5, filter: { type: "lowpass", from: 1600, to: 380 } },
  ],
  countBeep: [
    { type: "square", from: 880, to: 880, at: 0, dur: 0.1, gain: 0.45, filter: { type: "lowpass", from: 3000 } },
  ],
  countGo: [
    {
      type: "square",
      from: 1318.51,
      to: 1318.51,
      at: 0,
      dur: 0.24,
      gain: 0.5,
      filter: { type: "lowpass", from: 4000 },
    },
    { type: "triangle", from: 659.25, to: 659.25, at: 0, dur: 0.24, gain: 0.4 },
  ],
  coin: [
    { type: "square", from: 987.77, to: 987.77, at: 0, dur: 0.06, gain: 0.4, filter: { type: "lowpass", from: 5000 } },
    {
      type: "square",
      from: 1318.51,
      to: 1318.51,
      at: 0.06,
      dur: 0.2,
      gain: 0.4,
      filter: { type: "lowpass", from: 5000 },
    },
  ],
  // The arcade (research 10 §3): Candle Hop's wing and gap "tuiing" (a ladder up a fifth over the streak), Line Rider's
  // combo ticks, milestones, landings and the scrape grain the game loops while the runners touch the line; the crash.
  wing: [
    {
      type: "noise",
      from: 0,
      to: 0,
      at: 0,
      dur: 0.09,
      gain: 0.45,
      filter: { type: "bandpass", from: 900, to: 2200, q: 1.1 },
    },
    { type: "triangle", from: 520, to: 700, at: 0, dur: 0.06, gain: 0.2 },
  ],
  gap: [
    { type: "triangle", from: 674.25, to: 783.99, at: 0, dur: 0.16, gain: 0.8 },
    { type: "sine", from: 1567.98, to: 1567.98, at: 0.012, dur: 0.1, gain: 0.3 },
  ],
  comboStep: [{ type: "triangle", from: 1046.5, to: 1046.5, at: 0, dur: 0.07, gain: 0.6 }],
  milestone: [
    { type: "square", from: 1046.5, to: 1046.5, at: 0, dur: 0.09, gain: 0.45, filter: { type: "lowpass", from: 5000 } },
    { type: "triangle", from: 1567.98, to: 1567.98, at: 0.05, dur: 0.16, gain: 0.45 },
  ],
  landing: [
    thud(170, 52, 0.2, 0.9),
    { type: "noise", from: 0, to: 0, at: 0, dur: 0.06, gain: 0.3, filter: { type: "lowpass", from: 800 } },
  ],
  scrape: [
    {
      type: "noise",
      from: 0,
      to: 0,
      at: 0,
      dur: 0.25,
      gain: 0.5,
      env: "hold",
      filter: { type: "bandpass", from: 1200, q: 0.9 },
    },
  ],
  crash: [
    {
      type: "sawtooth",
      from: 330,
      to: 218,
      at: 0,
      dur: 0.62,
      gain: 0.45,
      detune: -7,
      filter: { type: "lowpass", from: 1800, to: 260 },
    },
    {
      type: "sawtooth",
      from: 494,
      to: 326,
      at: 0,
      dur: 0.62,
      gain: 0.45,
      detune: 7,
      filter: { type: "lowpass", from: 1800, to: 260 },
    },
    thud(170, 40, 0.55, 0.7),
  ],
  matchFound: [
    ...arpeggio([440, 554.37, 659.25, 880], 0.07, 0.35),
    { type: "sine", from: 1760, to: 1760, at: 0.21, dur: 0.4, gain: 0.25 },
  ],
  eventLock: [
    { type: "square", from: 659.25, to: 659.25, at: 0, dur: 0.05, gain: 0.4, filter: { type: "lowpass", from: 3000 } },
    { type: "square", from: 880, to: 880, at: 0.05, dur: 0.08, gain: 0.4, filter: { type: "lowpass", from: 3000 } },
  ],
  // A settled event: the stamp's thud with paper under it, and a bright ring on top.
  verdict: [
    thud(160, 58, 0.26, 0.95),
    { type: "noise", from: 0, to: 0, at: 0, dur: 0.12, gain: 0.45, filter: { type: "lowpass", from: 2000, to: 300 } },
    { type: "triangle", from: 1046.5, to: 1046.5, at: 0.08, dur: 0.3, gain: 0.4 },
  ],
};

/** The reference mix: each cue's level under the app's master. */
export const SOUND_MIX: Record<SoundCue, number> = {
  tap: 0.3,
  toggle: 0.25,
  sheetOpen: 0.22,
  sheetClose: 0.2,
  success: 0.45,
  error: 0.35,
  open: 0.55,
  close: 0.55,
  win: 0.5,
  loss: 0.45,
  refund: 0.4,
  profit: 0.35,
  adverse: 0.07,
  slump: 0.14,
  surge: 0.13,
  mega: 0.16,
  reelSpin: 0.35,
  reelTick: 0.12,
  reelLock: 0.5,
  jackpot: 0.5,
  nearMiss: 0.35,
  cardDeal: 0.3,
  cardFlip: 0.3,
  cardSlam: 0.5,
  countBeep: 0.35,
  countGo: 0.45,
  coin: 0.35,
  wing: 0.25,
  gap: 0.3,
  comboStep: 0.25,
  milestone: 0.4,
  landing: 0.45,
  scrape: 0.18,
  crash: 0.55,
  matchFound: 0.5,
  eventLock: 0.35,
  verdict: 0.55,
};
/** Raised from 0.7 to Tradash's level (research 01 E3: Senryo played at 0.5–0.63× of it). */
export const SOUND_MASTER = 0.9;

export const SEMITONES_PER_OCTAVE = 12;
/** The combo ladder: a major pentatonic over two octaves, one step up per favourable move. */
export const SOUND_LADDER_SEMITONES = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24] as const;

/**
 * Cues that climb: each plays its voices transposed by its ladder's step (the phone renders one WAV per step, the web
 * transposes live). The profit ladder; Lucky's three reels landing up a major chord; Candle Hop's gaps climbing a
 * fifth over a streak; Line Rider's combo ticks on the pentatonic and its milestones a semitone a multiplier.
 */
export const SOUND_LADDERS = {
  profit: SOUND_LADDER_SEMITONES,
  reelLock: [0, 4, 7],
  gap: [0, 1, 2, 3, 4, 5, 6, 7],
  comboStep: [0, 2, 4, 7, 9, 12, 14, 16],
  milestone: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
} as const satisfies Partial<Record<SoundCue, readonly number[]>>;
export type LadderCue = keyof typeof SOUND_LADDERS;

/** A ladder step's pitch ratio (clamped to the ladder). */
export function ladderRate(cue: LadderCue, step: number): number {
  const ladder: readonly number[] = SOUND_LADDERS[cue];
  const i = Math.max(0, Math.min(ladder.length - 1, Math.floor(step)));
  return 2 ** ((ladder[i] ?? 0) / SEMITONES_PER_OCTAVE);
}
