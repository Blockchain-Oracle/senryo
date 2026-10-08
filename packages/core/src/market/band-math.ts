// The client mirror of `contracts/src/markets/BandMath.sol`, bit for bit (BigInt for every uint/int step; `/` truncates
// toward zero like the EVM's `div`/`sdiv`). The Φ table is the contract's own hex constant, decoded the same way.
// Checked against the deployed `BandReserve.quoteOpen` by `scripts/drive/src/band-quote-check.ts`.
import { lnWad } from "./lnwad.ts";

/** Probabilities × 1e6 (contracts `P_ONE`). */
export const P_ONE = 1_000_000n;
/** Basis points (contracts `BPS`). */
export const BPS = 10_000n;
/** σ√τ uses at least this many seconds (contracts `MIN_SECONDS_LEFT`). */
export const MIN_SECONDS_LEFT = 5n;

const Z_STEP_E4 = 500n;
const Z_MAX_E4 = 40_000n;
const WAD = 10n ** 18n;
const Z_DIVISOR_SCALE = 10n ** 10n;
const ROOT_SCALE = 10_000n;
const ROOT_DIVISOR = 100n;
const HALF = 2n;
const ENTRY_HEX = 6;
const HEX_RADIX = 16;
/** Φ(z) × 1e6 for z = 0.00, 0.05 … 4.00 — `BandMath.CDF`, three bytes per entry. */
const CDF_HEX =
  "07a12007ef03083cb4088a0208d6bc0922b2096db709b79f0a003e0a476d0a8d060ad0e80b12f30b530a0b91140bccfd0c06b10c3e210c73440ca6100cd6810d04950d304e0d59b00d80c20da58e0dc8200de8840e06cb0e23070e3d490e55a50e6c310e81010e942b0ea5c50eb5e60ec4a30ed2130ede4c0ee9620ef36a0efc780f049e0f0bf10f12800f185c0f1d950f223a0f26590f29fe0f2d360f300b0f32870f34b50f369c0f38450f39b60f3af60f3c0b0f3cfa0f3dc80f3e780f3f100f3f910f3fff0f405d0f40ac0f40ef0f41280f41570f417f0f41a10f41bd0f41d40f41e80f41f80f42050f42100f42190f4220";
const CDF: readonly bigint[] = Array.from({ length: CDF_HEX.length / ENTRY_HEX }, (_, i) =>
  BigInt(Number.parseInt(CDF_HEX.slice(i * ENTRY_HEX, (i + 1) * ENTRY_HEX), HEX_RADIX)),
);

export type BandKind = "up" | "down" | "range" | "moonshot" | "crash";
/** One entry of a series' band menu (the catalogue's `BandSpec`; contracts `BandDef`). */
export interface BandShape {
  kind: BandKind;
  lowBps: number;
  highBps: number;
}
export type BandOutcome = "lose" | "win" | "refund";

function tableAt(i: bigint): bigint {
  const value = CDF[Number(i)];
  if (value === undefined) throw new Error(`no Φ table entry ${i}`);
  return value;
}

/** Φ(z) × 1e6, linear between table points, saturating past |z| = 4. */
export function cdfE6(zE4: bigint): bigint {
  if (zE4 < 0n) return P_ONE - cdfE6(-zE4);
  if (zE4 >= Z_MAX_E4) return P_ONE;
  const i = zE4 / Z_STEP_E4;
  const frac = zE4 % Z_STEP_E4;
  const lo = tableAt(i);
  const hi = tableAt(i + 1n);
  return lo + ((hi - lo) * frac) / Z_STEP_E4;
}

/** ⌊√x⌋ (the contract's Babylonian steps). */
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

/** σ√τ × 1e8 over `tauSec`, floored at `MIN_SECONDS_LEFT`. */
export function stdE8(sigmaE8: bigint, tauSec: bigint): bigint {
  const tau = tauSec < MIN_SECONDS_LEFT ? MIN_SECONDS_LEFT : tauSec;
  return (sigmaE8 * isqrt(tau * ROOT_SCALE)) / ROOT_DIVISOR;
}

/** z × 1e4 of `edge` from `spot`: ln(edge / spot) in standard deviations. */
export function zOfE4(edgeE8: bigint, spotE8: bigint, std: bigint): bigint {
  if (edgeE8 <= 0n || spotE8 <= 0n) throw new Error("NonPositivePrice");
  if (std === 0n) throw new Error("NoVolatility");
  const ratioWad = (edgeE8 * WAD) / spotE8;
  if (ratioWad === 0n) return -Z_MAX_E4;
  return (lnWad(ratioWad) * BPS) / (std * Z_DIVISOR_SCALE);
}

/** P(close > edge) × 1e6 with the price at `spot` now. */
export const aboveE6 = (edgeE8: bigint, spotE8: bigint, std: bigint): bigint =>
  P_ONE - cdfE6(zOfE4(edgeE8, spotE8, std));

/** `K × bps / 10,000`, truncated (contracts `offsetE8`). */
export const offsetE8 = (k: bigint, bps: number): bigint => (k * BigInt(bps)) / BPS;

/** What the band pays with, × 1e6, at `spot` with `tauSec` to expiry (contracts `probE6`, D-262). */
export function probE6(band: BandShape, k: bigint, spot: bigint, sigmaE8: bigint, tauSec: bigint): bigint {
  const std = stdE8(sigmaE8, tauSec);
  switch (band.kind) {
    case "up":
      return aboveE6(k, spot, std);
    case "down":
      return P_ONE - aboveE6(k, spot, std);
    case "range": {
      const lo = aboveE6(k - offsetE8(k, band.lowBps), spot, std);
      const hi = aboveE6(k + offsetE8(k, band.highBps), spot, std);
      return lo > hi ? lo - hi : 0n;
    }
    case "moonshot":
      return aboveE6(k + offsetE8(k, band.lowBps), spot, std);
    case "crash":
      return P_ONE - aboveE6(k - offsetE8(k, band.lowBps), spot, std);
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
