/**
 * Lucky (S8.8, D-295; Owarine packages/core/src/games/lucky.ts re-based on Senryo): spin, and a sealed draw picks a
 * market, a side and a reach; the call placed is one ordinary call at the band whose payout is nearest that reach.
 * The server seals `keccak(serverSeed)` before the player's own seed exists, so neither chose the draw alone; the
 * digest is keccak(serverSeed ‖ clientSeed ‖ owner ‖ the sealed market list), which both apps re-hash. The draw is
 * an index into the market list sealed with it, so a verifier replays the same list. Reach tops at 20×: the pool's
 * 3 % probability floor plus its spread is the highest multiple a band can pay.
 */

const REACH_2X = 2;
const REACH_3X = 3;
const REACH_5X = 5;
const REACH_10X = 10;
const REACH_20X = 20;
export const LUCKY_REACHES = [REACH_2X, REACH_3X, REACH_5X, REACH_10X, REACH_20X] as const;
export type LuckyReach = (typeof LUCKY_REACHES)[number];
export const LUCKY_SIDES = ["up", "down"] as const;
export type LuckySide = (typeof LUCKY_SIDES)[number];

/** Headroom for a signature between the deal and the fill; 1-minute windows are too short to deal. */
export const LUCKY_MIN_HEADROOM_SEC = 120;
const FIVE_MIN_SEC = 300;
const FIFTEEN_MIN_SEC = 900;
const HOUR_SEC = 3600;
export const LUCKY_CADENCES = [FIVE_MIN_SEC, FIFTEEN_MIN_SEC, HOUR_SEC] as const;
/** A sealed seed lives this long before it must be revealed. */
export const LUCKY_SEAL_TTL_SEC = 600;
/** Past this the live multiple has moved far enough from the dealt one that the card says so (bps). */
export const LUCKY_DRIFT_BPS = 1_000n;

const BPS = 10_000n;
const P_ONE = 1_000_000n;
/** Each index reads its own 64 bits of the digest (bias below n / 2⁶⁴ for these small lists). */
const WORD_BITS = 64n;
const WORD_MASK = (1n << WORD_BITS) - 1n;
const INDEX_MARKET = 0n;
const INDEX_SIDE = 1n;
const INDEX_REACH = 2n;

export interface LuckyDraw {
  symbol: string;
  side: LuckySide;
  reach: LuckyReach;
}

const pick = (digest: bigint, slot: bigint, n: number): number =>
  Number(((digest >> (slot * WORD_BITS)) & WORD_MASK) % BigInt(n));

/** The draw a digest makes over the sealed market list. */
export function luckyDrawOf(digest: bigint, markets: readonly string[]): LuckyDraw {
  if (markets.length === 0) throw new Error("a draw needs at least one market");
  return {
    symbol: markets[pick(digest, INDEX_MARKET, markets.length)] as string,
    side: LUCKY_SIDES[pick(digest, INDEX_SIDE, LUCKY_SIDES.length)] as LuckySide,
    reach: LUCKY_REACHES[pick(digest, INDEX_REACH, LUCKY_REACHES.length)] as LuckyReach,
  };
}

/** A priced candidate: a window's band and the price per share (probability + spread) it would fill at now. */
export interface LuckyQuoted {
  windowId: string;
  band: number;
  expirySec: number;
  priceE6: bigint;
}

/** The price per $1 share at which a call pays `reach` times its stake. */
export const targetPriceE6 = (reach: number): bigint => P_ONE / BigInt(reach);

/** The candidate whose price sits closest to 1 / reach; on a tie the soonest close, so nobody waits longer than needed. */
export function chooseLucky<T extends LuckyQuoted>(quotes: readonly T[], reach: number): T | null {
  const target = targetPriceE6(reach);
  let best: T | null = null;
  let bestDistance = -1n;
  for (const q of quotes) {
    const distance = q.priceE6 > target ? q.priceE6 - target : target - q.priceE6;
    if (best === null || distance < bestDistance || (distance === bestDistance && q.expirySec < best.expirySec)) {
      best = q;
      bestDistance = distance;
    }
  }
  return best;
}

/** Whether the live price has moved more than the drift tolerance from the dealt one. */
export const luckyDrifted = (dealtE6: bigint, liveE6: bigint): boolean => {
  const moved = liveE6 > dealtE6 ? liveE6 - dealtE6 : dealtE6 - liveE6;
  return moved * BPS > dealtE6 * LUCKY_DRIFT_BPS;
};

/** Wins in a row from the newest settled call back (refunds don't break or extend it). */
export function luckyStreak(results: readonly ("won" | "lost" | "refunded" | "open")[]): number {
  let streak = 0;
  for (const r of results) {
    if (r === "open" || r === "refunded") continue;
    if (r === "lost") break;
    streak += 1;
  }
  return streak;
}
