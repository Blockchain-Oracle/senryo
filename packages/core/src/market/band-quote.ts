// What a call would get, computed on the device every frame (D-272) with the contracts' own rules
// (`BandBook._fillOpen` / `_fillClose`, `BandReserve.quoteOpen`); the relay re-checks and the fill print decides.
import { type BandShape, BPS, P_ONE, payoutFor, probE6, proceedsFor } from "./band-math.ts";

const HUNDRED = 100n;

/** The pool's pricing terms (catalogue `terms`) plus the live load surcharge for the window's expiry. */
export interface QuoteTerms {
  halfSpreadE6: bigint;
  minProbE6: bigint;
  maxProbE6: bigint;
  /** `maxSurchargeE6 × reservedByExpiry / maxExpiryReserved` for this expiry; 0 on an unloaded pool. */
  surchargeE6: bigint;
}

/** Where the window stands: its open print K, σ per √s, and the seconds from the fill print to expiry. */
export interface QuoteWindow {
  openE8: bigint;
  sigmaE8: bigint;
  tauSec: bigint;
}

/** `price`: outside the pool's probability bounds · `capacity`: the fill would not fit the pool (BandPool `_hasCapacity`). */
export type QuoteRefusal = "price" | "capacity";

export interface OpenQuote {
  probE6: bigint;
  /** Price per share: probability + half-spread + surcharge. */
  priceE6: bigint;
  /** Shares the stake buys (what a win pays), 0 when refused. */
  payout: bigint;
  refusal: QuoteRefusal | null;
}

/** An open of `stake` on `band` at `spotE8` — refused exactly where the contract would refuse it for price. */
export function quoteOpen(band: BandShape, w: QuoteWindow, spotE8: bigint, stake: bigint, t: QuoteTerms): OpenQuote {
  const prob = probE6(band, w.openE8, spotE8, w.sigmaE8, w.tauSec);
  const priceE6 = prob + t.halfSpreadE6 + t.surchargeE6;
  const refused = prob < t.minProbE6 || prob > t.maxProbE6 || priceE6 >= P_ONE;
  const payout = refused ? 0n : payoutFor(stake, priceE6);
  // The pool must front something, or the call is not a bet against it.
  const priced = !refused && payout > stake;
  return { probE6: prob, priceE6, payout: priced ? payout : 0n, refusal: priced ? null : "price" };
}

export interface CloseQuote {
  probE6: bigint;
  /** The bid per share: probability − half-spread. */
  bidE6: bigint;
  proceeds: bigint;
  refusal: QuoteRefusal | null;
}

/** Selling `shares` of a ticket on `band` at `spotE8`. */
export function quoteClose(band: BandShape, w: QuoteWindow, spotE8: bigint, shares: bigint, t: QuoteTerms): CloseQuote {
  const prob = probE6(band, w.openE8, spotE8, w.sigmaE8, w.tauSec);
  if (prob < t.minProbE6 || prob > t.maxProbE6) return { probE6: prob, bidE6: 0n, proceeds: 0n, refusal: "price" };
  const bidE6 = prob - t.halfSpreadE6;
  return { probE6: prob, bidE6, proceeds: proceedsFor(shares, bidE6), refusal: null };
}

/** The least a signed call accepts: the quote less `toleranceBps` (the fill prints a second later). */
export const withTolerance = (amount: bigint, toleranceBps: bigint): bigint => (amount * (BPS - toleranceBps)) / BPS;

/** "pays 1.92×" — the payout per dollar staked, × 100 (integer hundredths for display). */
export const multiplierE2 = (stake: bigint, payout: bigint): bigint => (stake === 0n ? 0n : (payout * HUNDRED) / stake);

/** What a window's load costs: `maxSurchargeE6 × reservedByExpiry / maxExpiryReserved` (BandBook / BandReserve). */
export function loadSurchargeE6(maxSurchargeE6: bigint, reservedByExpiry: bigint, maxExpiryReserved: bigint): bigint {
  return maxExpiryReserved > 0n ? (maxSurchargeE6 * reservedByExpiry) / maxExpiryReserved : 0n;
}

/**
 * The most a new fill may reserve now (`payout − stake`), as BandPool `_hasCapacity` decides it: the pool's liquid
 * dollars, total exposure within `maxExposureBps` of the pool, and the expiry's own cap. Never negative.
 */
export function reserveCapacity(
  load: { reservedByExpiry: bigint; liquid: bigint; reserved: bigint },
  caps: { maxExpiryReserved: bigint; maxExposureBps: bigint },
): bigint {
  const exposure = ((load.liquid + load.reserved) * caps.maxExposureBps - load.reserved * BPS) / BPS;
  const expiry = caps.maxExpiryReserved - load.reservedByExpiry;
  const least = [load.liquid, exposure, expiry].reduce((a, b) => (b < a ? b : a));
  return least > 0n ? least : 0n;
}

/** An open quote checked against the pool's room: a fill reserves `payout − stake`, and must fit `capacity`. */
export function fitOpen(q: OpenQuote, stake: bigint, capacity: bigint | undefined): OpenQuote {
  if (q.refusal || capacity === undefined || q.payout - stake <= capacity) return q;
  return { ...q, refusal: "capacity" };
}
