/**
 * The music, one definition for both apps (D-317, F2): chiptune loops sequenced in code — a pulse lead, a triangle
 * bass, a dark pad and a three-piece kit — re-written from Owarine's games bed and terminal tracks
 * (`web/src/features/games/bed.ts`, `lib/sound/music.ts`), which wrote the recipe the way Pips writes its game audio:
 * oscillators and noise on the audio clock, not licensed files. The web books each sixteenth's voices on the Web Audio
 * clock (`apps/web/src/lib/feedback/music.ts`); the phone plays the same loops rendered to WAV
 * (`apps/mobile/scripts/gen-sounds.mjs`). A song's voices for one step come from `stepVoices`, timed from that step.
 */
import type { Voice, Wave } from "./sound.ts";

export type SongName = "games" | "arcade" | "rush" | "night" | "duel";

interface Chord {
  /** Root as MIDI; the third in semitones (3 minor, 4 major). */
  root: number;
  third: number;
}

interface Song {
  bpm: number;
  /** One chord a bar, cycled. */
  chords: readonly Chord[];
  bars: number;
  /** The lead per sixteenth as indexes into [root, third, fifth, octave] an octave up; null rests. */
  lead: readonly (number | null)[];
  /** An answering lead for the loop's second half (the games bed's motif), else the lead throughout. */
  answer?: readonly (number | null)[];
  leadWave: Wave;
  /** The bass per eighth, semitones above the root an octave down; null rests. */
  bass: readonly (number | null)[];
  /** The kit per sixteenth: k kick, s snare, h hat, H accented hat, . rest. */
  kit: string;
  /** A pad chord at each bar's start. */
  pad: boolean;
  gain: number;
}

const ARCADE_CHORDS: readonly Chord[] = [
  { root: 57, third: 3 },
  { root: 53, third: 4 },
  { root: 48, third: 4 },
  { root: 55, third: 4 },
];
const ARP = [0, 1, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1];

export const SONGS: Record<SongName, Song> = {
  /** The games bed: A minor, 112 bpm, eight bars, the arpeggio answered by a motif. */
  games: {
    bpm: 112,
    chords: ARCADE_CHORDS,
    bars: 8,
    lead: ARP,
    answer: [3, null, 2, null, 1, 2, null, 3, null, null, 2, 1, 0, null, 1, null],
    leadWave: "square",
    bass: [0, 12, 0, 12, 0, 12, 7, 12],
    kit: "kh.hsh.hkh.hshhh",
    pad: true,
    gain: 1,
  },
  arcade: {
    bpm: 112,
    chords: ARCADE_CHORDS,
    bars: 4,
    lead: ARP,
    leadWave: "square",
    bass: [0, 12, 0, 12, 0, 12, 7, 12],
    kit: "kh.hsh.hkh.hshhh",
    pad: true,
    gain: 0.9,
  },
  rush: {
    bpm: 128,
    chords: [
      { root: 52, third: 3 },
      { root: 52, third: 3 },
      { root: 48, third: 4 },
      { root: 50, third: 4 },
    ],
    bars: 4,
    lead: [0, null, 2, null, 3, null, 2, 0, null, 2, null, 3, 2, null, 1, null],
    leadWave: "sawtooth",
    bass: [0, 0, 12, 0, 0, 12, 0, 7],
    kit: "khshkhshkhshkhsh",
    pad: true,
    gain: 0.8,
  },
  night: {
    bpm: 92,
    chords: [
      { root: 50, third: 3 },
      { root: 46, third: 4 },
      { root: 53, third: 4 },
      { root: 48, third: 4 },
    ],
    bars: 4,
    lead: [2, null, null, 1, null, null, 0, null, 3, null, null, 2, null, 1, null, null],
    leadWave: "triangle",
    bass: [0, 0, 7, 0, 0, 12, 7, 0],
    kit: "k...s...k.k.s...",
    pad: true,
    gain: 0.85,
  },
  /** Duel's pulse: sparse — a heartbeat kick, a low bass and a far-off lead, under the cards rather than over them. */
  duel: {
    bpm: 96,
    chords: [
      { root: 45, third: 3 },
      { root: 45, third: 3 },
      { root: 41, third: 4 },
      { root: 43, third: 4 },
    ],
    bars: 4,
    lead: [null, null, null, null, 3, null, null, null, null, null, null, null, 2, null, null, null],
    leadWave: "triangle",
    bass: [0, null, null, null, 0, null, 7, null],
    kit: "k..k............",
    pad: false,
    gain: 0.9,
  },
};

export const SONG_TITLES: Record<SongName, string> = {
  games: "Arcade",
  arcade: "Arcade",
  rush: "Rush",
  night: "Night",
  duel: "Duel",
};
/** The terminal's ♪ chip cycles these. */
export const TERMINAL_SONGS: readonly SongName[] = ["arcade", "rush", "night"];

/** The music's level under the master, its fade-in, a track change's crossfade, and the tense filter (research 01). */
export const MUSIC_GAIN = 0.32;
export const MUSIC_FADE_IN_S = 1.2;
export const MUSIC_CROSSFADE_S = 0.5;
export const MUSIC_TENSE_HZ = 900;
export const MUSIC_TENSE_IN_S = 1.5;
export const MUSIC_TENSE_OUT_S = 0.6;
/** Ducking under a verdict: down 6 dB in 80 ms, back over 400 ms (research 10 §7). */
export const MUSIC_DUCK = 0.5;
export const MUSIC_DUCK_IN_S = 0.08;
export const MUSIC_DUCK_OUT_S = 0.4;

const SIXTEENTHS_PER_BAR = 16;
const STEPS_PER_BEAT = 4;
const SECONDS_PER_MINUTE = 60;
const A4_MIDI = 69;
const A4_HZ = 440;
const OCTAVE = 12;
const FIFTH = 7;
const midiHz = (note: number) => A4_HZ * 2 ** ((note - A4_MIDI) / OCTAVE);

const LEAD_GAIN = 0.07;
const LEAD_LEN = 0.9;
const LEAD_CUTOFF = 3200;
const BASS_GAIN = 0.22;
const BASS_LEN = 1.8;
const PAD_GAIN = 0.028;
const PAD_DETUNE = 6;
const PAD_CUTOFF = 900;
const KICK = { from: 150, to: 42, dur: 0.16, gain: 0.55 } as const;
const SNARE = { cutoff: 1800, dur: 0.12, gain: 0.32 } as const;
const HAT = { cutoff: 7500, dur: 0.04, gain: 0.08, accent: 0.14 } as const;

export function stepSeconds(song: SongName): number {
  return SECONDS_PER_MINUTE / SONGS[song].bpm / STEPS_PER_BEAT;
}

export function songSteps(song: SongName): number {
  return SONGS[song].bars * SIXTEENTHS_PER_BAR;
}

/** Every voice that starts on `step` of the loop (`at` 0 is the step's start). */
export function stepVoices(name: SongName, step: number): Voice[] {
  const song = SONGS[name];
  const stepSec = stepSeconds(name);
  const bar = Math.floor(step / SIXTEENTHS_PER_BAR) % song.bars;
  const s = step % SIXTEENTHS_PER_BAR;
  const chord = song.chords[bar % song.chords.length] ?? { root: 57, third: 3 };
  const tones = [chord.root, chord.root + chord.third, chord.root + FIFTH, chord.root + OCTAVE];
  const out: Voice[] = [];
  const g = song.gain;
  const line = song.answer && bar >= song.bars / 2 ? song.answer : song.lead;
  const pick = line[s];
  const leadNote = pick === null || pick === undefined ? undefined : tones[pick];
  if (leadNote !== undefined) {
    const hz = midiHz(leadNote + OCTAVE);
    out.push({
      type: song.leadWave,
      from: hz,
      to: hz,
      at: 0,
      dur: stepSec * LEAD_LEN,
      gain: LEAD_GAIN * g,
      env: "hold",
      filter: { type: "lowpass", from: LEAD_CUTOFF },
    });
  }
  const bassStep = s % 2 === 0 ? song.bass[s / 2] : undefined;
  if (bassStep !== null && bassStep !== undefined) {
    const hz = midiHz(chord.root - OCTAVE + bassStep);
    out.push({ type: "triangle", from: hz, to: hz, at: 0, dur: stepSec * BASS_LEN, gain: BASS_GAIN * g, env: "hold" });
  }
  if (song.pad && s === 0) {
    for (const note of tones.slice(0, 3)) {
      const hz = midiHz(note);
      for (const detune of [-PAD_DETUNE, PAD_DETUNE]) {
        out.push({
          type: "sawtooth",
          from: hz,
          to: hz,
          at: 0,
          dur: stepSec * SIXTEENTHS_PER_BAR,
          gain: PAD_GAIN * g,
          detune,
          env: "hold",
          filter: { type: "lowpass", from: PAD_CUTOFF },
        });
      }
    }
  }
  const hit = song.kit[s];
  if (hit === "k") out.push({ type: "sine", from: KICK.from, to: KICK.to, at: 0, dur: KICK.dur, gain: KICK.gain * g });
  if (hit === "s") {
    out.push({
      type: "noise",
      from: 0,
      to: 0,
      at: 0,
      dur: SNARE.dur,
      gain: SNARE.gain * g,
      filter: { type: "bandpass", from: SNARE.cutoff },
    });
  }
  if (hit === "h" || hit === "H") {
    out.push({
      type: "noise",
      from: 0,
      to: 0,
      at: 0,
      dur: HAT.dur,
      gain: (hit === "H" ? HAT.accent : HAT.gain) * g,
      filter: { type: "highpass", from: HAT.cutoff },
    });
  }
  return out;
}
