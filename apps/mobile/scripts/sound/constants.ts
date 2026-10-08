/** The terminal cues' synthesis tables (gen-trade-sounds.mjs): Tradash's measured contours, Owarine's voices. */

export const RATE = 44_100;
export const ATTACK_S = 0.005;
export const FLOOR = 1e-4;
export const TAIL_S = 0.02;
export const PCM_MAX = 32_767;
export const HEADROOM = 0.9;

export interface Voice {
  type: "sine" | "triangle";
  from: number;
  to: number;
  at: number;
  dur: number;
  gain: number;
}

/** C5 E5 G5 C6 (+E6 for mega), 45 ms apart, triangle. */
const ARPEGGIO = [523.25, 659.25, 783.99, 1046.5];
const MEGA_TOP = 1318.51;
const ARP_GAP_S = 0.045;
const ARP_DUR_S = 0.12;
const ARP_GAIN = 0.8;
const arpeggio = (notes: readonly number[]): Voice[] =>
  notes.map((f, i) => ({ type: "triangle", from: f, to: f, at: ARP_GAP_S * i, dur: ARP_DUR_S, gain: ARP_GAIN }));

export const CUES: Record<string, Voice[]> = {
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

/** The combo ladder: a major pentatonic over two octaves, one step per favourable move. */
export const LADDER_SEMITONES = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
export const SEMITONES_PER_OCTAVE = 12;

/** Canonical 44-byte PCM WAV header: mono, 16-bit. */
export const WAV = {
  headerBytes: 44,
  riffSizeOffset: 4,
  waveOffset: 8,
  fmtSizeOffset: 16,
  fmtSize: 16,
  formatOffset: 20,
  pcmFormat: 1,
  channelsOffset: 22,
  channels: 1,
  rateOffset: 24,
  byteRateOffset: 28,
  blockAlignOffset: 32,
  bitsOffset: 34,
  bits: 16,
  dataOffset: 36,
  dataSizeOffset: 40,
  bytesPerSample: 2,
  riffSizeBase: 36,
} as const;
