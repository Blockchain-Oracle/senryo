// The client mirror of `contracts/src/markets/BandMath.sol`, bit for bit (BigInt for every uint/int step; `/` truncates
// toward zero like the EVM's `div`/`sdiv`). The shape table is the contract's own generated constant (`tail-table.ts`,
// from `scripts/calibrate/table.json`), decoded the same way. Checked against the deployed `BandReserve.quoteOpen` by
// `scripts/drive/src/band-quote-check.ts` and against Foundry's vectors.
import { expWad } from "./expwad.ts";
import { lnWad } from "./lnwad.ts";
import { TAIL_TABLE_HEX } from "./tail-table.ts";

/** Probabilities × 1e6 (contracts `P_ONE`). */
export const P_ONE = 1_000_000n;
/** Basis points (contracts `BPS`). */
export const BPS = 10_000n;
/** σ√τ uses at least this many seconds (contracts `MIN_SECONDS_LEFT`). */
export const MIN_SECONDS_LEFT = 5n;

const WAD = 1_000_000_000_000_000_000n;
const Z_DIVISOR_SCALE = 10_000_000_000n;
/** A z past every table's last point (contracts `Z_BEYOND_E4`). */
const Z_BEYOND_E4 = 1_000_000_000_000n;
const HALF = 2n;
const HEX_PER_BYTE = 2;
const HEX_RADIX = 16;
/** The blob layout (contracts `MarketTypes` TAIL_*). */
const TAIL_HEADER_BYTES = 22;
const TAIL_POINTS_AT = 2;
const TAIL_Z_STEP_AT = 4;
const TAIL_WEIGHT_AT = 6;
const TAIL_FADE_AT = 14;
const U16_BYTES = 2;
const U64_BYTES = 8;
const ENTRY_BYTES = 3;

/** A shape table decoded from its data contract's bytes (contracts `BandMath.Shape`). */
export interface TailShape {
  points: bigint;
  zStepE4: bigint;
  zMaxE4: bigint;
  weightWad: bigint;
  fadeWad: bigint;
  taus: readonly bigint[];
  /** Every row's F_τ(z) × 1e6, rows by horizon. */
  cdf: readonly bigint[];
}

function uintAt(hex: string, at: number, bytes: number): bigint {
  return BigInt(`0x${hex.slice(at * HEX_PER_BYTE, (at + bytes) * HEX_PER_BYTE)}`);
}

/** Decodes a table blob (`TailTableData.BLOB`, or the code of the reserve's `tailTable()` without its leading 00). */
export function decodeTailShape(hex: string): TailShape {
  const n = Number.parseInt(hex.slice(HEX_PER_BYTE, 2 * HEX_PER_BYTE), HEX_RADIX);
  const points = uintAt(hex, TAIL_POINTS_AT, U16_BYTES);
  const zStepE4 = uintAt(hex, TAIL_Z_STEP_AT, U16_BYTES);
  const taus = Array.from({ length: n }, (_, i) => uintAt(hex, TAIL_HEADER_BYTES + i * U16_BYTES, U16_BYTES));
  const rowsAt = TAIL_HEADER_BYTES + n * U16_BYTES;
  const cdf = Array.from({ length: n * Number(points) }, (_, i) => uintAt(hex, rowsAt + i * ENTRY_BYTES, ENTRY_BYTES));
  return {
    points,
    zStepE4,
    zMaxE4: (points - 1n) * zStepE4,
    weightWad: uintAt(hex, TAIL_WEIGHT_AT, U64_BYTES),
    fadeWad: uintAt(hex, TAIL_FADE_AT, U64_BYTES),
    taus,
    cdf,
  };
}

/** The table the reserve prices with (generated from `scripts/calibrate/table.json`). */
export const TAIL_SHAPE: TailShape = decodeTailShape(TAIL_TABLE_HEX);

export type BandKind = "up" | "down" | "range" | "moonshot" | "crash";
/** One entry of a series' band menu (the catalogue's `BandSpec`; contracts `BandDef`). */
export interface BandShape {
  kind: BandKind;
  lowBps: number;
  highBps: number;
}
export type BandOutcome = "lose" | "win" | "refund";

/** ⌊√x⌋ (the contract uses Solady's `sqrt`; the floor root is unique). */
export function isqrt(x: bigint): bigint {
  if (x === 0n) return 0n;
  let z = (x + 1n) / HALF;
  let y = x;
  while (z < y) {
    y = z;
    z = (x / z + z) / HALF;
  }
  return y;
}

/** a · g(κτ) × 1e18: the share of the mark's departure from the long run a horizon keeps (contracts `markShareWad`). */
export function markShareWad(tauSec: bigint, s: TailShape = TAIL_SHAPE): bigint {
  const x = s.fadeWad * tauSec;
  const g = x === 0n ? WAD : ((WAD - expWad(-x)) * WAD) / x;
  return (s.weightWad * g) / WAD;
}

/** σ_τ√τ × 1e8 over `tauSec` (floored at `MIN_SECONDS_LEFT`): the mark faded into the long run (contracts `stdE8`). */
export function stdE8(markE8: bigint, longE8: bigint, tauSec: bigint, s: TailShape = TAIL_SHAPE): bigint {
  const tau = tauSec < MIN_SECONDS_LEFT ? MIN_SECONDS_LEFT : tauSec;
  const longVar = longE8 * longE8;
  const gap = markE8 * markE8 - longVar;
  const varE16 = longVar + (gap * markShareWad(tau, s)) / WAD;
  return isqrt(varE16 * tau);
}

function at<T>(xs: readonly T[], i: number | bigint): T {
  const v = xs[Number(i)];
  if (v === undefined) throw new Error(`no shape table entry ${i}`);
  return v;
}

/** The table row at or below `tauSec` and the weight × 1e18 of the next one (contracts `rowOf`). */
function rowOf(tauSec: bigint, s: TailShape): [number, bigint] {
  const last = s.taus.length - 1;
  if (tauSec <= at(s.taus, 0)) return [0, 0n];
  if (tauSec >= at(s.taus, last)) return [last, 0n];
  let row = 0;
  while (at(s.taus, row + 1) <= tauSec) row++;
  const a = at(s.taus, row);
  return [row, ((tauSec - a) * WAD) / (at(s.taus, row + 1) - a)];
}

function rowAt(row: number, i: bigint, frac: bigint, s: TailShape): bigint {
  const base = BigInt(row) * s.points + i;
  const lo = at(s.cdf, base);
  if (frac === 0n) return lo;
  const hi = at(s.cdf, base + 1n);
  return lo + ((hi - lo) * frac) / s.zStepE4;
}

/** F_τ(z) × 1e6: the calibrated shape, linear in z and in τ between table points, symmetric (contracts `cdfE6`). */
export function cdfE6(zE4: bigint, tauSec: bigint, s: TailShape = TAIL_SHAPE): bigint {
  if (zE4 < 0n) return P_ONE - cdfE6(-zE4, tauSec, s);
  if (zE4 >= s.zMaxE4) return P_ONE;
  const i = zE4 / s.zStepE4;
  const frac = zE4 % s.zStepE4;
  const [row, w] = rowOf(tauSec, s);
  const lo = rowAt(row, i, frac, s);
  if (w === 0n) return lo;
  const hi = rowAt(row + 1, i, frac, s);
  return (lo * (WAD - w) + hi * w) / WAD;
}

/** z × 1e4 of `edge` from `spot`: ln(edge / spot) in standard deviations. */
export function zOfE4(edgeE8: bigint, spotE8: bigint, std: bigint): bigint {
  if (edgeE8 <= 0n || spotE8 <= 0n) throw new Error("NonPositivePrice");
  if (std === 0n) throw new Error("NoVolatility");
  const ratioWad = (edgeE8 * WAD) / spotE8;
  if (ratioWad === 0n) return -Z_BEYOND_E4;
  return (lnWad(ratioWad) * BPS) / (std * Z_DIVISOR_SCALE);
}

/** P(close > edge) × 1e6 with the price at `spot` now, `tauSec` from the close. */
export const aboveE6 = (
  edgeE8: bigint,
  spotE8: bigint,
  std: bigint,
  tauSec: bigint,
  s: TailShape = TAIL_SHAPE,
): bigint => P_ONE - cdfE6(zOfE4(edgeE8, spotE8, std), tauSec, s);

/** `K × bps / 10,000`, truncated (contracts `offsetE8`). */
export const offsetE8 = (k: bigint, bps: number): bigint => (k * BigInt(bps)) / BPS;

/** What the band pays with, × 1e6, at `spot` with `tauSec` to expiry, σ the keeper's mark faded into the series' long
 *  run (contracts `probE6`, D-262, D-300). */
export function probE6(
  band: BandShape,
  k: bigint,
  spot: bigint,
  markE8: bigint,
  longE8: bigint,
  tauSec: bigint,
  s: TailShape = TAIL_SHAPE,
): bigint {
  const std = stdE8(markE8, longE8, tauSec, s);
  switch (band.kind) {
    case "up":
      return aboveE6(k, spot, std, tauSec, s);
    case "down":
      return P_ONE - aboveE6(k, spot, std, tauSec, s);
    case "range": {
      const lo = aboveE6(k - offsetE8(k, band.lowBps), spot, std, tauSec, s);
      const hi = aboveE6(k + offsetE8(k, band.highBps), spot, std, tauSec, s);
      return lo > hi ? lo - hi : 0n;
    }
    case "moonshot":
      return aboveE6(k + offsetE8(k, band.lowBps), spot, std, tauSec, s);
    case "crash":
      return P_ONE - aboveE6(k - offsetE8(k, band.lowBps), spot, std, tauSec, s);
  }
}

/** How the band settles on the close print (contracts `outcome`, D-263). */
export function bandOutcome(band: BandShape, k: bigint, close: bigint): BandOutcome {
  switch (band.kind) {
    case "up":
    case "down":
      if (close === k) return "refund";
      return close > k === (band.kind === "up") ? "win" : "lose";
    case "range":
      return close >= k - offsetE8(k, band.lowBps) && close <= k + offsetE8(k, band.highBps) ? "win" : "lose";
    case "moonshot":
      return close > k + offsetE8(k, band.lowBps) ? "win" : "lose";
    case "crash":
      return close < k - offsetE8(k, band.lowBps) ? "win" : "lose";
  }
}

/** Shares a stake buys at `qE6` per share, floored. */
export const payoutFor = (stake: bigint, qE6: bigint): bigint => (stake * P_ONE) / qE6;

/** What `shares` sell for at `bidE6`, floored. */
export const proceedsFor = (shares: bigint, bidE6: bigint): bigint => (shares * bidE6) / P_ONE;

/** The basis leaving with `shares` of a ticket holding `payout` shares on `basis`, ceiled. */
export function basisPart(basis: bigint, shares: bigint, payout: bigint): bigint {
  const num = basis * shares;
  return num === 0n ? 0n : (num - 1n) / payout + 1n;
}
