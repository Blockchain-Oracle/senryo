import { RIDE_STATE, type RideChange } from "@senryo/chain";
import { type ChainId, RIDE_TERMS } from "@senryo/config";
import { rideShare } from "@senryo/core";
import type { Db } from "./db.ts";

/**
 * The services' ride book (`market_rides`, `ride_exits`; R4.6): what the relay and keeper know of every ride, driven
 * only by the reserve's own events in receipts the services sent or saw. A part close takes margin and reserve out as
 * the contract does (`LinearMath.share`, ceiled), so the row stays equal to `rideOf`.
 */

/** Every applied change is announced here (Postgres NOTIFY); the api pushes it to the owner's stream. */
export const RIDE_CHANNEL = "market_ride";

/** A live ride (pending, open or closing) — the states the keeper and the watchers work on. */
export const LIVE_RIDE_STATES = ["committed", "open", "closing"] as const;

const ENDED: Readonly<Record<number, string>> = {
  [RIDE_STATE.closed]: "closed",
  [RIDE_STATE.knockedOut]: "knocked_out",
  [RIDE_STATE.capped]: "capped",
  [RIDE_STATE.ended]: "ended",
};

export interface RideRow {
  ride_id: bigint;
  owner: string;
  market_id: number;
  is_long: boolean;
  state: string;
  margin: bigint;
  /** The margin it opened with (0031, and 0032 from the signed opens; null only for a ride with no signed open). */
  margin_open: bigint | null;
  leverage_bps: number;
  open_fee: bigint;
  target: bigint | null;
  limit_e8: bigint | null;
  closing: string;
  entry_e8: bigint | null;
  size: string;
  reserve: bigint;
  ko_e8: bigint | null;
  cap_e8: bigint | null;
  filled_at: bigint | null;
  end_at: bigint | null;
  exit_e8: bigint | null;
  pnl: string | null;
  fees: bigint;
  paid: bigint;
  how: number | null;
  refund_reason: number | null;
  /** The transaction that last moved it: the one that ended it, once it has. */
  last_tx: string | null;
  updated_at: Date;
}

/** What the api hears on `RIDE_CHANNEL`: the change and the ride's row after it (bigints as strings). */
export interface RideNotice {
  chainId: ChainId;
  change: RideChange["kind"];
  rideId: string;
  owner: string;
  state: string;
  marketId: number;
  isLong: boolean;
  margin: string;
  size: string;
  entryE8: string | null;
  koE8: string | null;
  capE8: string | null;
  exitE8: string | null;
  pnl: string | null;
  paid: string;
  txHash: string | null;
}

async function rideRow(db: Db, chainId: ChainId, rideId: bigint): Promise<RideRow | undefined> {
  const [row] = await db<RideRow[]>`SELECT * FROM market_rides WHERE chain_id = ${chainId} AND ride_id = ${rideId}`;
  return row;
}

async function announce(db: Db, chainId: ChainId, c: RideChange, txHash: string | null): Promise<void> {
  const r = await rideRow(db, chainId, c.rideId);
  if (!r) return;
  const notice: RideNotice = {
    chainId,
    change: c.kind,
    rideId: r.ride_id.toString(),
    owner: r.owner,
    state: r.state,
    marketId: r.market_id,
    isLong: r.is_long,
    margin: r.margin.toString(),
    size: r.size,
    entryE8: r.entry_e8?.toString() ?? null,
    koE8: r.ko_e8?.toString() ?? null,
    capE8: r.cap_e8?.toString() ?? null,
    exitE8: r.exit_e8?.toString() ?? null,
    pnl: r.pnl,
    paid: r.paid.toString(),
    txHash,
  };
  await db`SELECT pg_notify(${RIDE_CHANNEL}, ${JSON.stringify(notice)})`;
}

/** Applies ride changes in order (a receipt's, from `rideChanges`), each announced. */
export async function applyRideChanges(
  db: Db,
  chainId: ChainId,
  changes: readonly RideChange[],
  txHash: string | null = null,
): Promise<void> {
  const life = RIDE_TERMS[chainId].maxLifeSec;
  for (const c of changes) {
    switch (c.kind) {
      case "rideCommitted":
        await db`
          INSERT INTO market_rides (chain_id, ride_id, owner, market_id, is_long, state, margin, margin_open,
                                    leverage_bps, open_fee, target, limit_e8, commit_tx, last_tx)
          VALUES (${chainId}, ${c.rideId}, ${c.owner.toLowerCase()}, ${c.marketId}, ${c.isLong}, 'committed',
                  ${c.margin}, ${c.margin}, ${c.leverageBps}, ${c.openFee}, ${c.target}, ${c.limitE8}, ${txHash},
                  ${txHash})
          ON CONFLICT (chain_id, ride_id) DO NOTHING`;
        break;
      case "rideFilled":
        // A ride fills at its target and lives the network's `maxLifeSec` from there (contracts `RideMarket`).
        await db`UPDATE market_rides SET state = 'open', entry_e8 = ${c.entryE8}, size = ${c.size.toString()},
                 reserve = ${c.reserve}, open_fee = ${c.openFee}, ko_e8 = ${c.koE8}, cap_e8 = ${c.capE8},
                 filled_at = target, end_at = target + ${life}, target = NULL, limit_e8 = NULL, last_tx = ${txHash},
                 updated_at = now()
                 WHERE chain_id = ${chainId} AND ride_id = ${c.rideId} AND state = 'committed'`;
        break;
      case "rideRefused":
        await db`UPDATE market_rides SET state = 'refunded', refund_reason = ${c.reason}, paid = ${c.refunded},
                 target = NULL, limit_e8 = NULL, last_tx = ${txHash}, updated_at = now()
                 WHERE chain_id = ${chainId} AND ride_id = ${c.rideId}`;
        break;
      case "rideClosing":
        await db`UPDATE market_rides SET state = 'closing', closing = ${c.size.toString()}, limit_e8 = ${c.limitE8},
                 target = ${c.target}, last_tx = ${txHash}, updated_at = now()
                 WHERE chain_id = ${chainId} AND ride_id = ${c.rideId}`;
        break;
      case "rideCloseRefused":
        await db`UPDATE market_rides SET state = 'open', closing = 0, limit_e8 = NULL, target = NULL,
                 last_tx = ${txHash}, updated_at = now()
                 WHERE chain_id = ${chainId} AND ride_id = ${c.rideId} AND state = 'closing'`;
        break;
      case "rideExited":
        await applyExit(db, chainId, c, txHash);
        break;
      case "rideExitSet":
        await saveRideExit(db, chainId, c);
        break;
      case "rideExitFired":
        await db`UPDATE ride_exits SET fired_at = now(), fired_kind = ${c.exitKind}, updated_at = now()
                 WHERE chain_id = ${chainId} AND ride_id = ${c.rideId}`;
        break;
    }
    await announce(db, chainId, c, txHash);
  }
}

/** A part leaves margin and reserve pro rata (ceiled, as the contract stores it); the last part ends the ride. */
async function applyExit(
  db: Db,
  chainId: ChainId,
  c: Extract<RideChange, { kind: "rideExited" }>,
  txHash: string | null,
): Promise<void> {
  const r = await rideRow(db, chainId, c.rideId);
  if (!r) return;
  const size = BigInt(r.size);
  const last = c.how !== RIDE_STATE.open || c.size === size;
  const marginOut = last ? r.margin : rideShare(r.margin, c.size, size);
  const reserveOut = last ? r.reserve : rideShare(r.reserve, c.size, size);
  const state = last ? (ENDED[c.how] ?? "closed") : "open";
  await db`UPDATE market_rides SET state = ${state}, size = ${(size - c.size).toString()},
           margin = ${r.margin - marginOut}, reserve = ${r.reserve - reserveOut}, closing = 0, limit_e8 = NULL,
           target = NULL, exit_e8 = ${c.exitE8}, pnl = ${(BigInt(r.pnl ?? "0") + c.pnl).toString()},
           fees = fees + ${c.fees}, paid = paid + ${c.paid}, how = ${c.how}, last_tx = ${txHash}, updated_at = now()
           WHERE chain_id = ${chainId} AND ride_id = ${c.rideId}`;
  if (last) await db`DELETE FROM ride_exits WHERE chain_id = ${chainId} AND ride_id = ${c.rideId}`;
}

/** A ride's exit as the chain holds it (prices × 1e8, the trail in bps of the price); all 0 clears it. A changed trail
 *  restarts its peak. */
export async function saveRideExit(
  db: Db,
  chainId: ChainId,
  e: { rideId: bigint; takeProfit: bigint; stopLoss: bigint; floor: bigint; trail: bigint },
): Promise<void> {
  if (e.takeProfit === 0n && e.stopLoss === 0n && e.trail === 0n) {
    await db`DELETE FROM ride_exits WHERE chain_id = ${chainId} AND ride_id = ${e.rideId}`;
    return;
  }
  await db`
    INSERT INTO ride_exits (chain_id, ride_id, take_profit_e8, stop_loss_e8, floor_e8, trail_bps)
    VALUES (${chainId}, ${e.rideId}, ${e.takeProfit}, ${e.stopLoss}, ${e.floor}, ${e.trail})
    ON CONFLICT (chain_id, ride_id) DO UPDATE SET
      take_profit_e8 = EXCLUDED.take_profit_e8, stop_loss_e8 = EXCLUDED.stop_loss_e8, floor_e8 = EXCLUDED.floor_e8,
      trail_peak_e8 = CASE WHEN ride_exits.trail_bps = EXCLUDED.trail_bps THEN ride_exits.trail_peak_e8 ELSE 0 END,
      trail_bps = EXCLUDED.trail_bps, fired_at = NULL, updated_at = now()`;
}

/** One ride by id (its public receipt), whoever's it is. */
export async function rideById(db: Db, chainId: ChainId, rideId: bigint): Promise<RideRow | undefined> {
  return rideRow(db, chainId, rideId);
}

export async function ridesOf(db: Db, chainId: ChainId, owner: string, limit: number): Promise<RideRow[]> {
  return db<RideRow[]>`SELECT * FROM market_rides WHERE chain_id = ${chainId} AND owner = ${owner.toLowerCase()}
    ORDER BY ride_id DESC LIMIT ${limit}`;
}

/** Every live ride (pending, open or closing), oldest first: the watchers' and the keeper's work list. */
export async function liveRides(db: Db, chainId: ChainId): Promise<RideRow[]> {
  return db<RideRow[]>`SELECT * FROM market_rides WHERE chain_id = ${chainId}
    AND state IN ${db([...LIVE_RIDE_STATES])} ORDER BY ride_id`;
}

/** Instants in (sinceSec, untilSec] whose print a live ride needs: pending fill targets and ends of life. */
export async function rideInstantsAwaitingPrints(db: Db, sinceSec: number, untilSec: number) {
  return db<{ market_id: number; t: bigint }[]>`
    SELECT DISTINCT market_id, t FROM (
      SELECT market_id, target AS t FROM market_rides WHERE state IN ('committed', 'closing') AND target IS NOT NULL
      UNION ALL
      SELECT market_id, end_at FROM market_rides WHERE state IN ('open', 'closing') AND end_at IS NOT NULL
    ) wanted WHERE t > ${sinceSec} AND t <= ${untilSec}`;
}

/** Each market side's open rides (open or closing — both open on chain), ascending, for `refreshFrontier`. */
export async function openRidesBySide(db: Db, chainId: ChainId) {
  return db<{ market_id: number; is_long: boolean; ids: bigint[] }[]>`
    SELECT market_id, is_long, array_agg(ride_id ORDER BY ride_id) AS ids FROM market_rides
    WHERE chain_id = ${chainId} AND state IN ('open', 'closing') GROUP BY market_id, is_long ORDER BY market_id`;
}
