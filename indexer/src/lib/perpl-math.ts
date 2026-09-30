/**
 * Pure Perpl helpers (no Envio runtime import, so scripts/check-perpl-cursor.ts runs them on raw logs).
 *
 * Taker fills carry no accountId and no perpId, so every Position* event (any account) moves a one-row cursor, and the
 * next Maker/TakerOrderFilledV2 in the same tx consumes it (observed order: `Position*(A) > MakerF(A) > Position*(T) >
 * TakerF`, context/08-integrations/envio.md §5). The ordering is observed, not documented by Perpl — a mismatch counts
 * in ProtocolStats.unattributedFills (the alarm), never guesses.
 */
import { PERPL_CNS_DECIMALS, TEN, WAD_DECIMALS } from "./constants.ts";

export interface CursorState {
  txHash: string;
  logIndex: number;
  accountId: string;
  marketId: string;
  /** Fill row to enrich; set only when the account belongs to an app user. */
  fillId: string | undefined;
}

export interface FillLog {
  txHash: string;
  logIndex: number;
  /** Maker fills name their account; taker fills do not. */
  accountId?: string;
}

export type Pairing =
  | { ok: true; cursor: CursorState }
  | { ok: false; reason: "no-cursor" | "other-tx" | "out-of-order" | "other-account" };

export function pairFill(cursor: CursorState | undefined, fill: FillLog): Pairing {
  if (!cursor) return { ok: false, reason: "no-cursor" };
  if (cursor.txHash !== fill.txHash) return { ok: false, reason: "other-tx" };
  if (cursor.logIndex >= fill.logIndex) return { ok: false, reason: "out-of-order" };
  if (fill.accountId !== undefined && fill.accountId !== cursor.accountId)
    return { ok: false, reason: "other-account" };
  return { ok: true, cursor };
}

/** Perpl fixed-point (PNS/LNS with per-market decimals) → our 1e18. */
export function toWad(value: bigint, decimals: number): bigint {
  if (decimals === WAD_DECIMALS) return value;
  return decimals < WAD_DECIMALS
    ? value * TEN ** BigInt(WAD_DECIMALS - decimals)
    : value / TEN ** BigInt(decimals - WAD_DECIMALS);
}

/** Notional in usd6 (= CNS) of `lot` at `price`: price/10^pd × lot/10^ld × 10^6, rounded down. */
export function perplNotional(price: bigint, lot: bigint, priceDecimals: number, lotDecimals: number): bigint {
  return (price * lot * TEN ** BigInt(PERPL_CNS_DECIMALS)) / TEN ** BigInt(priceDecimals + lotDecimals);
}

/** Size-weighted entry after an increase (1e18 in, 1e18 out). */
export function weightedEntry(entry: bigint, size: bigint, price: bigint, delta: bigint): bigint {
  const total = size + delta;
  return total === 0n ? price : (entry * size + price * delta) / total;
}
