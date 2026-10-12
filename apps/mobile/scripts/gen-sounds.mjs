/**
 * Renders every sound the phone plays (D-317, F1–F2) from the definitions the web synthesises live, so both apps sound
 * the same: the cue map and its ladders (`@senryo/tokens` `sound.ts` → assets/sounds/cues/<cue>.wav and
 * <cue>-<step>.wav) and the music (`music.ts` → assets/sounds/music/<song>.wav, seamless loops, plus a low-passed
 * "tense" twin of each terminal track — the phone has no live filter). A small offline synth: sine, triangle, square,
 * saw and seeded noise; pitch glides; the pluck and hold envelopes; detune; an RBJ biquad whose cutoff sweeps.
 * Also writes `src/feedback/cue-sources.ts`, the static `require` map Metro needs. Our own audio — nothing of theirs.
 *   node apps/mobile/scripts/gen-sounds.mjs
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MUSIC_GAIN,
  MUSIC_TENSE_HZ,
  SONGS,
  songSteps,
  stepSeconds,
  stepVoices,
  TERMINAL_SONGS,
} from "../../../packages/tokens/src/music.ts";
import {
  SOUND_ATTACK_S as ATTACK_S,
  SOUND_CUES as CUES,
  SOUND_FILTER_Q as FILTER_Q,
  SOUND_FLOOR as FLOOR,
  SOUND_HOLD_ATTACK_S as HOLD_ATTACK_S,
  SOUND_HOLD_RELEASE_AT as HOLD_RELEASE_AT,
  SOUND_LADDERS as LADDERS,
  ladderRate,
} from "../../../packages/tokens/src/sound.ts";
import { HEADROOM, MUSIC_RATE, PCM_MAX, RATE, TAIL_S, WAV } from "./sound/constants.ts";

const TWO = 2;
const HALF = 0.5;
const CENTS_PER_OCTAVE = 1200;
/** The filter's coefficients are recomputed this often while its cutoff sweeps (samples). */
const FILTER_STRIDE = 16;
/** A held note's release time constant, as a fraction of its length (the web's `setTargetAtTime`). */
const HOLD_TAU = 0.09;
const SEED = 0x5e7c0de;
/** Marsaglia's xorshift32 shifts, and its range. */
const XOR_A = 13;
const XOR_B = 17;
const XOR_C = 5;
const U32_MAX = 0xffffffff;
/** A cutoff is held just under Nyquist. */
const NYQUIST_GUARD = 0.49;

/** A seeded xorshift: the noise is the same on every render, so a re-run changes no file it shouldn't. */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << XOR_A;
    s ^= s >>> XOR_B;
    s ^= s << XOR_C;
    return ((s >>> 0) / U32_MAX) * TWO - 1;
  };
}

function oscillator(type, phase) {
  const p = phase - Math.floor(phase);
  if (type === "triangle") return TWO * Math.abs(TWO * (p - Math.floor(p + HALF))) - 1;
  if (type === "square") return p < HALF ? 1 : -1;
  if (type === "sawtooth") return TWO * p - 1;
  return Math.sin(TWO * Math.PI * p);
}

function envelope(v, t) {
  if (v.env === "hold") {
    if (t < HOLD_ATTACK_S) return t / HOLD_ATTACK_S;
    const release = v.dur * HOLD_RELEASE_AT;
    return t < release ? 1 : Math.exp(-(t - release) / (v.dur * HOLD_TAU));
  }
  if (t < ATTACK_S) return FLOOR * (1 / FLOOR) ** (t / ATTACK_S);
  return FLOOR ** ((t - ATTACK_S) / (v.dur - ATTACK_S));
}

/** RBJ cookbook biquad coefficients, normalised by a0. */
function biquad(type, f0, q, rate) {
  const w = (TWO * Math.PI * Math.min(f0, rate * NYQUIST_GUARD)) / rate;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (TWO * q);
  let b0;
  let b1;
  let b2;
  if (type === "lowpass") [b0, b1, b2] = [(1 - cos) / TWO, 1 - cos, (1 - cos) / TWO];
  else if (type === "highpass") [b0, b1, b2] = [(1 + cos) / TWO, -(1 + cos), (1 + cos) / TWO];
  else [b0, b1, b2] = [alpha, 0, -alpha];
  const a0 = 1 + alpha;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: (-TWO * cos) / a0, a2: (1 - alpha) / a0 };
}

/** Adds one voice into `out` from sample `start` (wrapping past the end when `wrap`), at `level` and pitch `rate`. */
function addVoice(out, v, start, level, pitch, rate, noise, wrap) {
  const n = Math.round((v.dur + TAIL_S) * rate);
  const detune = v.detune ? TWO ** (v.detune / CENTS_PER_OCTAVE) : 1;
  let phase = 0;
  let c = null;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / rate;
    let s;
    if (v.type === "noise") s = noise();
    else {
      const f = (v.from === v.to ? v.from : v.from * (v.to / v.from) ** Math.min(1, t / v.dur)) * pitch * detune;
      phase += f / rate;
      s = oscillator(v.type, phase);
    }
    if (v.filter) {
      if (i % FILTER_STRIDE === 0) {
        const to = v.filter.to ?? v.filter.from;
        const cut = v.filter.from * (to / v.filter.from) ** Math.min(1, t / v.dur);
        c = biquad(v.filter.type, cut, v.filter.q ?? FILTER_Q, rate);
      }
      const y = c.b0 * s + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
      x2 = x1;
      x1 = s;
      y2 = y1;
      y1 = y;
      s = y;
    }
    const at = start + i;
    const idx = wrap ? at % out.length : at;
    if (idx < out.length) out[idx] += v.gain * level * (t <= v.dur ? envelope(v, t) : 0) * s;
  }
}

function pcm(samples, rate) {
  const peak = samples.reduce((m, x) => Math.max(m, Math.abs(x)), 0) || 1;
  const dataBytes = samples.length * WAV.bytesPerSample;
  const buf = Buffer.alloc(WAV.headerBytes + dataBytes);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(WAV.riffSizeBase + dataBytes, WAV.riffSizeOffset);
  buf.write("WAVEfmt ", WAV.waveOffset);
  buf.writeUInt32LE(WAV.fmtSize, WAV.fmtSizeOffset);
  buf.writeUInt16LE(WAV.pcmFormat, WAV.formatOffset);
  buf.writeUInt16LE(WAV.channels, WAV.channelsOffset);
  buf.writeUInt32LE(rate, WAV.rateOffset);
  buf.writeUInt32LE(rate * WAV.bytesPerSample, WAV.byteRateOffset);
  buf.writeUInt16LE(WAV.bytesPerSample, WAV.blockAlignOffset);
  buf.writeUInt16LE(WAV.bits, WAV.bitsOffset);
  buf.write("data", WAV.dataOffset);
  buf.writeUInt32LE(dataBytes, WAV.dataSizeOffset);
  for (let i = 0; i < samples.length; i += 1)
    buf.writeInt16LE(Math.round((samples[i] / peak) * HEADROOM * PCM_MAX), WAV.headerBytes + i * WAV.bytesPerSample);
  return buf;
}

function renderCue(voices, pitch) {
  const length = Math.ceil((Math.max(...voices.map((v) => v.at + v.dur)) + TAIL_S) * RATE);
  const out = new Float64Array(length);
  const noise = rng(SEED);
  for (const v of voices) addVoice(out, v, Math.round(v.at * RATE), 1, pitch, RATE, noise, false);
  return pcm(out, RATE);
}

/** One loop of a song, seamless: a note ringing past the end wraps to the start. Optionally low-passed (tense). */
function renderSong(name, tense) {
  const stepSec = stepSeconds(name);
  const steps = songSteps(name);
  const out = new Float64Array(Math.round(steps * stepSec * MUSIC_RATE));
  const noise = rng(SEED);
  for (let s = 0; s < steps; s += 1) {
    const start = Math.round(s * stepSec * MUSIC_RATE);
    for (const v of stepVoices(name, s)) {
      const voice = tense
        ? { ...v, filter: { type: "lowpass", from: Math.min(MUSIC_TENSE_HZ, v.filter?.from ?? MUSIC_TENSE_HZ) } }
        : v;
      addVoice(out, voice, start, MUSIC_GAIN, 1, MUSIC_RATE, noise, true);
    }
  }
  return pcm(out, MUSIC_RATE);
}

const app = join(dirname(fileURLToPath(import.meta.url)), "..");
const cueDir = join(app, "assets", "sounds", "cues");
const musicDir = join(app, "assets", "sounds", "music");
rmSync(cueDir, { recursive: true, force: true });
rmSync(musicDir, { recursive: true, force: true });
mkdirSync(cueDir, { recursive: true });
mkdirSync(musicDir, { recursive: true });

const cueFiles = [];
const ladderFiles = {};
for (const [name, voices] of Object.entries(CUES)) {
  if (name in LADDERS) {
    ladderFiles[name] = LADDERS[name].map((_, i) => {
      const file = `${name}-${i}.wav`;
      writeFileSync(join(cueDir, file), renderCue(voices, ladderRate(name, i)));
      return file;
    });
  } else {
    writeFileSync(join(cueDir, `${name}.wav`), renderCue(voices, 1));
    cueFiles.push(name);
  }
}
const songs = Object.keys(SONGS);
for (const song of songs) writeFileSync(join(musicDir, `${song}.wav`), renderSong(song, false));
for (const song of TERMINAL_SONGS) writeFileSync(join(musicDir, `${song}-tense.wav`), renderSong(song, true));

const req = (path) => `require("../../assets/sounds/${path}")`;
const lines = [
  "/** Generated by apps/mobile/scripts/gen-sounds.mjs from `@senryo/tokens` sound.ts and music.ts. Do not edit. */",
  'import type { AudioSource } from "expo-audio";',
  'import type { LadderCue, SongName, SoundCue } from "@senryo/tokens";',
  "",
  "export const CUE_SOURCES: Readonly<Record<Exclude<SoundCue, LadderCue>, AudioSource>> = {",
  ...cueFiles.map((c) => `  ${c}: ${req(`cues/${c}.wav`)},`),
  "};",
  "",
  "export const LADDER_SOURCES: Readonly<Record<LadderCue, readonly AudioSource[]>> = {",
  ...Object.entries(ladderFiles).map(([c, files]) => `  ${c}: [${files.map((f) => req(`cues/${f}`)).join(", ")}],`),
  "};",
  "",
  "export const SONG_SOURCES: Readonly<Record<SongName, AudioSource>> = {",
  ...songs.map((s) => `  ${s}: ${req(`music/${s}.wav`)},`),
  "};",
  "",
  "/** The terminal tracks low-passed: the phone crossfades to these while a call is down 5 % or more. */",
  "export const TENSE_SOURCES: Readonly<Partial<Record<SongName, AudioSource>>> = {",
  ...TERMINAL_SONGS.map((s) => `  ${s}: ${req(`music/${s}-tense.wav`)},`),
  "};",
  "",
];
writeFileSync(join(app, "src", "feedback", "cue-sources.ts"), lines.join("\n"));
console.log(
  `${cueFiles.length} cues, ${Object.values(ladderFiles).flat().length} ladder steps, ${songs.length} songs + ${TERMINAL_SONGS.length} tense → assets/sounds`,
);
