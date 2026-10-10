/**
 * The arcade's dice (S8.8, D-295; Owarine packages/core/src/games/arcade/rng.ts): xorshift32 seeded from eight hex
 * characters. Every draw comes from a generator whose whole state is one 32-bit word, so a seed and the inputs that
 * followed it reproduce a run to the tick — on the device that played it and on the server that checks it.
 */
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
}

const SEED_PATTERN = /^[0-9a-f]{8}$/;
/** xorshift never leaves zero, so a zero seed takes this constant instead. */
const ZERO_SEED_STAND_IN = 0x9e3779b9;
/** Marsaglia's xorshift32 triple. */
const SHIFT_A = 13;
const SHIFT_B = 17;
const SHIFT_C = 5;
const UINT32_RANGE = 4_294_967_296;
const HEX = 16;
const SEED_CHARS = 8;
const SEED_BYTES = 4;
const BYTE_BITS = 8;

export function isArcadeSeed(value: string): boolean {
  return SEED_PATTERN.test(value);
}

export function seedFromUint32(word: number): string {
  return (word >>> 0).toString(HEX).padStart(SEED_CHARS, "0");
}

export function seedToUint32(seed: string): number {
  if (!isArcadeSeed(seed)) throw new Error(`not an arcade seed: ${seed}`);
  return Number.parseInt(seed, HEX) >>> 0;
}

/** A seed from four random bytes (`crypto.getRandomValues` on a device, `randomBytes` on a server). */
export function seedFromBytes(bytes: Uint8Array): string {
  if (bytes.length < SEED_BYTES) throw new Error("an arcade seed needs four bytes");
  let word = 0;
  for (let i = 0; i < SEED_BYTES; i += 1) word = (word << BYTE_BITS) | (bytes[i] as number);
  return seedFromUint32(word);
}

export function createRng(seed: string): Rng {
  let state = seedToUint32(seed) || ZERO_SEED_STAND_IN;
  return {
    next() {
      state ^= state << SHIFT_A;
      state >>>= 0;
      state ^= state >>> SHIFT_B;
      state ^= state << SHIFT_C;
      state >>>= 0;
      return state / UINT32_RANGE;
    },
  };
}
