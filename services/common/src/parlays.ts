import type { Address, Hex, ParlayChange } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import type { Db } from "./db.ts";

/**
 * The services' parlay book (`market_parlays`, `market_parlay_legs`; S8.5, D-293): driven only by the reserve's own
 * parlay events in receipts the services sent, like the ticket book. Every applied change is announced on
 * `PARLAY_CHANNEL`; the api pushes it to the owner's stream and to the relay's intents.
 */
export const PARLAY_CHANNEL = "market_parlay";

const OUTCOME_NAMES = ["lose", "win", "refund"] as const;
const LEG_NAMES = ["pending", "won", "tied", "lost", "void"] as const;

export interface ParlayLegRef {
  windowId: Hex;
  seriesId: Hex;
  start: number;
  expiry: number;
  band: number;
}

export interface ParlayNotice {
  chainId: ChainId;
  change: ParlayChange["kind"];
  parlayId: string;
  owner: string;
  state: string;
  stake: string;
  payout: string;
  result: string | null;
  outcome: string | null;
  txHash: Hex | null;
}

export interface ParlayRow {
  parlay_id: bigint;
  owner: string;
  state: string;
  target: bigint | null;
  stake: bigint;
  payout: bigint;
  chance_e6: number | null;
  result: bigint | null;
  outcome: string | null;
  updated_at: Date;
}

export interface ParlayLegRow {
  leg: number;
  window_id: string;
  series_id: string;
  window_start: bigint;
  window_expiry: bigint;
  band: number;
  outcome: string;
}

/** Applies changes in order. `legsOf` names a new parlay's legs (the relay knows them; the keeper reads the chain). */
export async function applyParlayChanges(
  db: Db,
  chainId: ChainId,
  changes: readonly ParlayChange[],
  legsOf: (parlayId: bigint) => Promise<readonly ParlayLegRef[]>,
  txHash: Hex | null = null,
): Promise<void> {
  for (const c of changes) {
    switch (c.kind) {
      case "parlayCommitted": {
        await db`INSERT INTO market_parlays (chain_id, parlay_id, owner, state, target, stake)
          VALUES (${chainId}, ${c.parlayId}, ${c.owner.toLowerCase()}, 'committed', ${c.target}, ${c.stake})
          ON CONFLICT (chain_id, parlay_id) DO NOTHING`;
        for (const [leg, l] of (await legsOf(c.parlayId)).entries()) {
          await db`INSERT INTO market_parlay_legs (chain_id, parlay_id, leg, window_id, series_id, window_start,
                                                   window_expiry, band)
            VALUES (${chainId}, ${c.parlayId}, ${leg}, ${l.windowId}, ${l.seriesId}, ${l.start}, ${l.expiry}, ${l.band})
            ON CONFLICT (chain_id, parlay_id, leg) DO NOTHING`;
        }
        break;
      }
      case "parlayFilled":
        await db`UPDATE market_parlays SET state = 'open', payout = ${c.payout}, chance_e6 = ${c.chanceE6},
                 target = NULL, updated_at = now() WHERE chain_id = ${chainId} AND parlay_id = ${c.parlayId}`;
        break;
      case "parlayRefused":
        await db`UPDATE market_parlays SET state = 'refunded', target = NULL, result = ${c.refunded},
                 outcome = 'refund', updated_at = now() WHERE chain_id = ${chainId} AND parlay_id = ${c.parlayId}`;
        break;
      case "parlayLegDecided":
        await db`UPDATE market_parlay_legs SET outcome = ${LEG_NAMES[c.outcome] ?? "pending"}
                 WHERE chain_id = ${chainId} AND parlay_id = ${c.parlayId} AND leg = ${c.leg}`;
        await db`UPDATE market_parlays SET updated_at = now() WHERE chain_id = ${chainId} AND parlay_id = ${c.parlayId}`;
        break;
      case "parlaySettled":
        await db`UPDATE market_parlays SET state = 'settled', outcome = ${OUTCOME_NAMES[c.outcome] ?? null},
                 result = ${c.amount}, updated_at = now() WHERE chain_id = ${chainId} AND parlay_id = ${c.parlayId}`;
        break;
    }
    await announce(db, chainId, c, txHash);
  }
}

async function announce(db: Db, chainId: ChainId, c: ParlayChange, txHash: Hex | null): Promise<void> {
  const [row] = await db<ParlayRow[]>`
    SELECT * FROM market_parlays WHERE chain_id = ${chainId} AND parlay_id = ${c.parlayId}`;
  if (!row) return;
  const notice: ParlayNotice = {
    chainId,
    change: c.kind,
    parlayId: row.parlay_id.toString(),
    owner: row.owner,
    state: row.state,
    stake: row.stake.toString(),
    payout: row.payout.toString(),
    result: row.result?.toString() ?? null,
    outcome: row.outcome,
    txHash,
  };
  await db`SELECT pg_notify(${PARLAY_CHANNEL}, ${JSON.stringify(notice)})`;
}

/** An owner's parlays, newest first, each with its legs in close order. */
export async function parlaysOf(
  db: Db,
  chainId: ChainId,
  owner: Address,
  limit: number,
): Promise<(ParlayRow & { legs: ParlayLegRow[] })[]> {
  const rows = await db<ParlayRow[]>`SELECT * FROM market_parlays WHERE chain_id = ${chainId}
    AND owner = ${owner.toLowerCase()} ORDER BY parlay_id DESC LIMIT ${limit}`;
  return withLegs(db, chainId, rows);
}

async function withLegs(db: Db, chainId: ChainId, rows: ParlayRow[]) {
  if (rows.length === 0) return [];
  const legs = await db<(ParlayLegRow & { parlay_id: bigint })[]>`SELECT * FROM market_parlay_legs
    WHERE chain_id = ${chainId} AND parlay_id IN ${db(rows.map((r) => r.parlay_id))} ORDER BY parlay_id, leg`;
  return rows.map((r) => ({ ...r, legs: legs.filter((l) => l.parlay_id === r.parlay_id) }));
}

/** Parlays still waiting for their fill print, older than `staleSec` (the relay normally fills them in ~1 s). */
export async function pendingParlayFills(db: Db, chainId: ChainId, nowSec: number, staleSec: number) {
  const rows = await db<ParlayRow[]>`SELECT * FROM market_parlays WHERE chain_id = ${chainId}
    AND state = 'committed' AND target IS NOT NULL AND target < ${nowSec - staleSec} ORDER BY target LIMIT 32`;
  return withLegs(db, chainId, rows);
}

/** Filled parlays with a pending leg whose window ended `afterSec` ago or more: a verdict to record and settle. */
export async function parlaysToSettle(db: Db, chainId: ChainId, nowSec: number, afterSec: number) {
  const rows = await db<ParlayRow[]>`SELECT p.* FROM market_parlays p WHERE p.chain_id = ${chainId}
    AND p.state = 'open' AND EXISTS (SELECT 1 FROM market_parlay_legs l WHERE l.chain_id = p.chain_id
      AND l.parlay_id = p.parlay_id AND l.outcome = 'pending' AND l.window_expiry < ${nowSec - afterSec})
    ORDER BY p.parlay_id LIMIT 16`;
  return withLegs(db, chainId, rows);
}
