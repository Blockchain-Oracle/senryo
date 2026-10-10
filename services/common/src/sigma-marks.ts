import type { Hex } from "@senryo/chain";
import { lnWad, SIGMA_MARK_STEP_SEC, toE8 } from "@senryo/core";
import type { Db } from "./db.ts";

/**
 * σ marks (R4.3, D-300, D-313): each feed's volatility through each minute boundary, exactly as the calibration
 * defined it (`scripts/calibrate/series.py` `SigmaMarks`) — EWMAs of squared 1-minute log returns between boundary
 * prints, per √second: the fast mark (span 30) and the slow anchor (span 1,440, a day), each seeded with the plain mean
 * of its first 30 returns. A boundary print more than 5 s past its instant is no price (a closed or silent market), so
 * the returns on either side of it are skipped. Each return is taken exactly from the integer prints (`lnWad`), so
 * every service computes the same bits.
 *
 * The state is stored with every mark (`sigma_marks`), so each minute is the last one plus a return: the keeper writes
 * every feed's mark just after each minute and the relay writes one a fill finds missing. Whoever writes a minute
 * first wins and everyone reads that row, so the two can't disagree. The values are chain-independent; each service
 * signs them under its own chain's domain when it sends a fill (`@senryo/chain` `sigmaMarkRequest`).
 */
export const SIGMA_FAST_SPAN = 30;
export const SIGMA_SLOW_SPAN = 1_440;
/** Returns before either EWMA is a mark (the calibration's `min(span, 30)`). */
const SEED_RETURNS = 30;
const SIGMA_MINUTE_SEC = SIGMA_MARK_STEP_SEC;
const PRINT_MAX_AGE_SEC = 5;
/** How far back a missing state is rebuilt from the archive: three days carry the slow anchor to 0.25 % of its seed. */
const REBUILD_DAYS = 3;
const REBUILD_MINUTES = REBUILD_DAYS * SIGMA_SLOW_SPAN;
const E8 = 1e8;
const WAD = 1_000_000_000_000_000_000n;
const WAD_FLOAT = 1e18;

/** The EWMAs after a minute, and that minute's price × 1e8 (null when it had none). */
export interface SigmaState {
  priceE8: bigint | null;
  fastVar: number;
  fastSeen: number;
  slowVar: number;
  slowSeen: number;
}

export const EMPTY_SIGMA: SigmaState = { priceE8: null, fastVar: 0, fastSeen: 0, slowVar: 0, slowSeen: 0 };

/** A feed's mark through `minute` (the values a fill's `SigmaMark` carries). */
export interface SigmaMarkValue {
  feedId: Hex;
  minute: number;
  fastE8: bigint;
  slowE8: bigint;
}

function ewma(variance: number, seen: number, x2: number, span: number): number {
  if (seen < span) return (variance * seen + x2) / (seen + 1);
  const alpha = 2 / (span + 1);
  return alpha * x2 + (1 - alpha) * variance;
}

/** The log return from one price to the next, exactly (Solady `lnWad` on the ratio). */
const logReturn = (fromE8: bigint, toE8: bigint): number => Number(lnWad((toE8 * WAD) / fromE8)) / WAD_FLOAT;

/** One minute on: `priceE8` is the boundary's (null for none); a return needs this minute's and the last. */
export function stepSigma(s: SigmaState, priceE8: bigint | null): SigmaState {
  if (priceE8 === null || s.priceE8 === null || priceE8 <= 0n || s.priceE8 <= 0n) return { ...s, priceE8 };
  const r = logReturn(s.priceE8, priceE8);
  const x2 = r * r;
  return {
    priceE8,
    fastVar: ewma(s.fastVar, s.fastSeen, x2, SIGMA_FAST_SPAN),
    fastSeen: s.fastSeen + 1,
    slowVar: ewma(s.slowVar, s.slowSeen, x2, SIGMA_SLOW_SPAN),
    slowSeen: s.slowSeen + 1,
  };
}

/** σ per √second × 1e8 of a per-minute variance, at least 1 (the contract refuses a zero mark). */
const perSecondE8 = (variance: number): bigint =>
  BigInt(Math.max(1, Math.round(Math.sqrt(variance / SIGMA_MINUTE_SEC) * E8)));

/** The state's marks; before 30 returns, the market's listed σ (`fallbackE8`) for both. */
export function marksOf(s: SigmaState, fallbackE8: number): { fastE8: bigint; slowE8: bigint } {
  if (s.fastSeen < SEED_RETURNS || s.slowSeen < SEED_RETURNS) {
    const f = BigInt(Math.max(1, fallbackE8));
    return { fastE8: f, slowE8: f };
  }
  return { fastE8: perSecondE8(s.fastVar), slowE8: perSecondE8(s.slowVar) };
}

interface MarkRow {
  minute: bigint;
  fast_e8: bigint;
  slow_e8: bigint;
  price_e8: bigint | null;
  fast_var: number;
  fast_seen: number;
  slow_var: number;
  slow_seen: number;
}

const markValueOf = (feedId: Hex, r: MarkRow): SigmaMarkValue => ({
  feedId,
  minute: Number(r.minute),
  fastE8: r.fast_e8,
  slowE8: r.slow_e8,
});

const stateOf = (r: MarkRow): SigmaState => ({
  priceE8: r.price_e8,
  fastVar: r.fast_var,
  fastSeen: r.fast_seen,
  slowVar: r.slow_var,
  slowSeen: r.slow_seen,
});

export async function storedSigmaMark(db: Db, feedId: Hex, minute: number): Promise<SigmaMarkValue | undefined> {
  const [row] = await db<MarkRow[]>`SELECT * FROM sigma_marks WHERE feed_id = ${feedId} AND minute = ${minute}`;
  return row ? markValueOf(feedId, row) : undefined;
}

/** Every feed's marks for these minutes (the api's `/v1/markets/sigma` and stream). */
export async function sigmaMarksAt(db: Db, minutes: readonly number[]): Promise<SigmaMarkValue[]> {
  if (minutes.length === 0) return [];
  const rows = await db<(MarkRow & { feed_id: string })[]>`
    SELECT * FROM sigma_marks WHERE minute IN ${db(minutes.map(BigInt))} ORDER BY minute, feed_id`;
  return rows.map((r) => markValueOf(r.feed_id as Hex, r));
}

/**
 * The stored mark of `feedId` through `minute`, computing and storing it first if nobody has: from the last stored
 * state within three days (else from nothing three days back), one boundary print at a time. `minute` must have
 * passed — a boundary print not yet archived counts as none, for good.
 */
export async function sigmaMarkFor(db: Db, feedId: Hex, minute: number, fallbackE8: number): Promise<SigmaMarkValue> {
  if (minute % SIGMA_MINUTE_SEC !== 0) throw new Error(`σ mark minute ${minute} is not a boundary`);
  const stored = await storedSigmaMark(db, feedId, minute);
  if (stored) return stored;
  const earliest = minute - REBUILD_MINUTES * SIGMA_MINUTE_SEC;
  const [base] = await db<MarkRow[]>`
    SELECT * FROM sigma_marks WHERE feed_id = ${feedId} AND minute < ${minute} AND minute >= ${earliest}
    ORDER BY minute DESC LIMIT 1`;
  const from = base ? Number(base.minute) : earliest - SIGMA_MINUTE_SEC;
  const prints = await db<{ t: bigint; publish_time: bigint; price: bigint; expo: number }[]>`
    SELECT t, publish_time, price, expo FROM pyth_prints
    WHERE feed_id = ${feedId} AND t > ${from} AND t <= ${minute} AND t % ${SIGMA_MINUTE_SEC} = 0`;
  const priceAt = new Map(
    prints.filter((p) => p.publish_time - p.t <= PRINT_MAX_AGE_SEC).map((p) => [Number(p.t), toE8(p.price, p.expo)]),
  );
  let state = base ? stateOf(base) : EMPTY_SIGMA;
  for (let m = from + SIGMA_MINUTE_SEC; m <= minute; m += SIGMA_MINUTE_SEC) {
    state = stepSigma(state, priceAt.get(m) ?? null);
  }
  const { fastE8, slowE8 } = marksOf(state, fallbackE8);
  await db`
    INSERT INTO sigma_marks (feed_id, minute, fast_e8, slow_e8, price_e8, fast_var, fast_seen, slow_var, slow_seen)
    VALUES (${feedId}, ${minute}, ${fastE8}, ${slowE8}, ${state.priceE8}, ${state.fastVar}, ${state.fastSeen},
            ${state.slowVar}, ${state.slowSeen})
    ON CONFLICT (feed_id, minute) DO NOTHING`;
  const won = await storedSigmaMark(db, feedId, minute);
  if (!won) throw new Error(`σ mark ${feedId}@${minute} vanished`);
  return won;
}
