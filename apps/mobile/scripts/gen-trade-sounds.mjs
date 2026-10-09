/**
 * Renders the terminal's sound cues to WAV (assets/sounds/trade/*.wav): Tradash's cue map re-synthesised to the pitch
 * contours and lengths measured from its clips (canton-season3 context/13-revamp/tradash/SOUND-analysis.txt), with
 * Owarine's synth voices (owarine web/src/lib/sound/trade.ts): exponential 5 ms attack, exponential decay to silence,
 * exponential pitch glides. Our own audio — nothing of theirs is shipped. The voices are `@senryo/tokens` `sound.ts`
 * (the web synthesises the same table live); the WAV container is `sound/constants.ts`. Run after changing a voice:
 *   node apps/mobile/scripts/gen-trade-sounds.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SOUND_ATTACK_S as ATTACK_S,
  SOUND_CUES as CUES,
  SOUND_FLOOR as FLOOR,
  SOUND_LADDER_SEMITONES as LADDER_SEMITONES,
  SEMITONES_PER_OCTAVE,
} from "../../../packages/tokens/src/sound.ts";
import { HEADROOM, PCM_MAX, RATE, TAIL_S, WAV } from "./sound/constants.ts";

const TWO = 2;
const HALF = 0.5;
const wave = (type, phase) =>
  type === "triangle" ? TWO * Math.abs(TWO * (phase - Math.floor(phase + HALF))) - 1 : Math.sin(TWO * Math.PI * phase);

function render(voices) {
  const length = Math.ceil((Math.max(...voices.map((v) => v.at + v.dur)) + TAIL_S) * RATE);
  const out = new Float64Array(length);
  for (const v of voices) {
    let phase = 0;
    const start = Math.round(v.at * RATE);
    const n = Math.round(v.dur * RATE);
    for (let i = 0; i < n; i += 1) {
      const t = i / RATE;
      const freq = v.from === v.to ? v.from : v.from * (v.to / v.from) ** (t / v.dur);
      phase += freq / RATE;
      const env = t < ATTACK_S ? FLOOR * (1 / FLOOR) ** (t / ATTACK_S) : FLOOR ** ((t - ATTACK_S) / (v.dur - ATTACK_S));
      out[start + i] += v.gain * env * wave(v.type, phase);
    }
  }
  const peak = Math.max(...out.map(Math.abs)) || 1;
  const dataBytes = out.length * WAV.bytesPerSample;
  const pcm = Buffer.alloc(WAV.headerBytes + dataBytes);
  pcm.write("RIFF", 0);
  pcm.writeUInt32LE(WAV.riffSizeBase + dataBytes, WAV.riffSizeOffset);
  pcm.write("WAVEfmt ", WAV.waveOffset);
  pcm.writeUInt32LE(WAV.fmtSize, WAV.fmtSizeOffset);
  pcm.writeUInt16LE(WAV.pcmFormat, WAV.formatOffset);
  pcm.writeUInt16LE(WAV.channels, WAV.channelsOffset);
  pcm.writeUInt32LE(RATE, WAV.rateOffset);
  pcm.writeUInt32LE(RATE * WAV.bytesPerSample, WAV.byteRateOffset);
  pcm.writeUInt16LE(WAV.bytesPerSample, WAV.blockAlignOffset);
  pcm.writeUInt16LE(WAV.bits, WAV.bitsOffset);
  pcm.write("data", WAV.dataOffset);
  pcm.writeUInt32LE(dataBytes, WAV.dataSizeOffset);
  for (let i = 0; i < out.length; i += 1)
    pcm.writeInt16LE(Math.round((out[i] / peak) * HEADROOM * PCM_MAX), WAV.headerBytes + i * WAV.bytesPerSample);
  return pcm;
}

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "sounds", "trade");
mkdirSync(dir, { recursive: true });
for (const [name, voices] of Object.entries(CUES))
  if (name !== "profit") writeFileSync(join(dir, `${name}.wav`), render(voices));
LADDER_SEMITONES.forEach((semi, i) => {
  const k = TWO ** (semi / SEMITONES_PER_OCTAVE);
  writeFileSync(
    join(dir, `profit-${i}.wav`),
    render(CUES.profit.map((v) => ({ ...v, from: v.from * k, to: v.to * k }))),
  );
});
console.log(`${Object.keys(CUES).length} cues + ${LADDER_SEMITONES.length} ladder steps → ${dir}`);
