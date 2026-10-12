/**
 * The WAV container for every rendered sound (gen-sounds.mjs). The sounds themselves — voices, mix, ladders, songs —
 * are `@senryo/tokens` `sound.ts` and `music.ts`, shared with the web's live synth.
 */

export const RATE = 44_100;
/** Music renders at half rate: a chiptune's hats sit under 11 kHz, and the loops weigh half as much in the update. */
export const MUSIC_RATE = 22_050;
export const TAIL_S = 0.02;
export const PCM_MAX = 32_767;
export const HEADROOM = 0.9;

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
