/** Per-sound gain, levelled so the palette sits together (ported volumes). */
export const SOUND_VOLUME = {
  fill: 0.6,
  deposit: 0.55,
  send: 0.4,
  unlock: 0.35,
  liquidation: 0.7,
  error: 0.4,
} as const;

/** Delay (ms) between the two beats of the liquidation haptic: error, then heavy. */
export const LIQUIDATION_SECOND_BEAT_MS = 140;
