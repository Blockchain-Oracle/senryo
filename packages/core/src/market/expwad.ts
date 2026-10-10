// Ported from Solady v0.1.26 (acd959a) src/utils/FixedPointMathLib.sol `expWad` (MIT; Remco Bloemen's (6, 7)
// rational approximation) — the same integer steps in BigInt, so `band-math.ts` reproduces `BandMath.fadeWad` bit for
// bit (R3.3, D-300). `sar` is BigInt's `>>` (floor toward −∞) and `sdiv` BigInt's `/` (truncation), as in the EVM.

const EXP_ZERO_BELOW = -41_446_531_673_892_822_313n;
const EXP_OVERFLOW_AT = 135_305_999_368_893_231_589n;
const FIVE_POW_18 = 5n ** 18n;
const LN2_X96 = 54_916_777_467_707_473_351_141_471_128n;
const HALF_X96 = 2n ** 95n;
const SCALE = 3_822_833_074_963_236_453_042_738_258_902_158_003_155_416_615_667n;
const UINT256_MASK = (1n << 256n) - 1n;

/** Solady `expWad`: e^(x / 1e18) × 1e18 (0 below ln(1e-18); Solady reverts `ExpOverflow` past ≈ 135, so do we). */
export function expWad(x: bigint): bigint {
  if (x <= EXP_ZERO_BELOW) return 0n;
  if (x >= EXP_OVERFLOW_AT) throw new Error("ExpOverflow");
  let v = (x << 78n) / FIVE_POW_18;
  const k = ((v << 96n) / LN2_X96 + HALF_X96) >> 96n;
  v = v - k * LN2_X96;
  let y = v + 1_346_386_616_545_796_478_920_950_773_328n;
  y = ((y * v) >> 96n) + 57_155_421_227_552_351_082_224_309_758_442n;
  let p = y + v - 94_201_549_194_550_492_254_356_042_504_812n;
  p = ((p * y) >> 96n) + 28_719_021_644_029_726_153_956_944_680_412_240n;
  p = p * v + (4_385_272_521_454_847_904_659_076_985_693_276n << 96n);
  let q = v - 2_855_989_394_907_223_263_936_484_059_900n;
  q = ((q * v) >> 96n) + 50_020_603_652_535_783_019_961_831_881_945n;
  q = ((q * v) >> 96n) - 533_845_033_583_426_703_283_633_433_725_380n;
  q = ((q * v) >> 96n) + 3_604_857_256_930_695_427_073_651_918_091_429n;
  q = ((q * v) >> 96n) - 14_423_608_567_350_463_180_887_372_962_807_573n;
  q = ((q * v) >> 96n) + 26_449_188_498_355_588_339_934_803_723_976_023n;
  const r = p / q;
  return ((r * SCALE) & UINT256_MASK) >> (195n - k);
}
