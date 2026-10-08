import type { Address, Hex, TicketChange } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import type { Db } from "./db.ts";

/**
 * The services' ticket book (`market_tickets`, D-278): what the relay and keeper know of every call, driven only by the
 * reserve's own events in receipts the services sent (or saw), never by guesses. The indexer (S4) becomes the history
 * of record; this table stays the keeper's work list.
 */

export interface WindowRef {
  windowId: Hex;
  seriesId: Hex;
  start: number;
  expiry: number;
}

const OUTCOME_NAMES = ["lose", "win", "refund"] as const;

/** Applies changes in order. `windowOf` resolves a committed ticket's window (the relay knows it; the keeper reads it). */
export async function applyTicketChanges(
  db: Db,
  chainId: ChainId,
  changes: readonly TicketChange[],
  windowOf: (windowId: Hex) => Promise<WindowRef>,
): Promise<void> {
  for (const c of changes) {
    switch (c.kind) {
      case "committed": {
        const w = await windowOf(c.windowId);
        await db`
          INSERT INTO market_tickets (chain_id, ticket_id, owner, window_id, series_id, window_start, window_expiry, band,
                                      state, target, stake)
          VALUES (${chainId}, ${c.ticketId}, ${c.owner.toLowerCase()}, ${c.windowId}, ${w.seriesId}, ${w.start},
                  ${w.expiry}, ${c.band}, 'committed', ${c.target}, ${c.stake})
          ON CONFLICT (chain_id, ticket_id) DO NOTHING`;
        break;
      }
      case "filled":
        await db`UPDATE market_tickets SET state = 'open', payout = ${c.payout}, stake = ${c.stake}, entry_e8 = ${c.entryE8},
                 target = NULL, updated_at = now() WHERE chain_id = ${chainId} AND ticket_id = ${c.ticketId}`;
        break;
      case "refused":
        await db`UPDATE market_tickets SET state = 'refunded', target = NULL, result = ${c.refunded}, outcome = 'refund',
                 updated_at = now() WHERE chain_id = ${chainId} AND ticket_id = ${c.ticketId}`;
        break;
      case "closing":
        await db`UPDATE market_tickets SET state = 'closing', target = ${c.target}, updated_at = now()
                 WHERE chain_id = ${chainId} AND ticket_id = ${c.ticketId}`;
        break;
      case "closed":
        await db`UPDATE market_tickets SET payout = payout - ${c.shares}, stake = stake - ${c.basisOut},
                 result = COALESCE(result, 0) + ${c.proceeds}, target = NULL, updated_at = now(),
                 state = CASE WHEN payout - ${c.shares} = 0 THEN 'closed' ELSE 'open' END
                 WHERE chain_id = ${chainId} AND ticket_id = ${c.ticketId}`;
        break;
      case "closeRefused":
        await db`UPDATE market_tickets SET state = 'open', target = NULL, updated_at = now()
                 WHERE chain_id = ${chainId} AND ticket_id = ${c.ticketId} AND state = 'closing'`;
        break;
      case "claimed":
        await db`UPDATE market_tickets SET state = 'settled', target = NULL, outcome = ${OUTCOME_NAMES[c.outcome] ?? null},
                 result = COALESCE(result, 0) + ${c.amount}, updated_at = now()
                 WHERE chain_id = ${chainId} AND ticket_id = ${c.ticketId}`;
        break;
    }
  }
}

export interface TicketRow {
  ticket_id: bigint;
  owner: string;
  window_id: string;
  series_id: string;
  window_start: bigint;
  window_expiry: bigint;
  band: number;
  state: string;
  target: bigint | null;
  stake: bigint;
  payout: bigint;
  entry_e8: bigint | null;
  result: bigint | null;
  outcome: string | null;
  updated_at: Date;
}

export async function ticketsOf(db: Db, chainId: ChainId, owner: Address, limit: number): Promise<TicketRow[]> {
  return db<TicketRow[]>`SELECT * FROM market_tickets WHERE chain_id = ${chainId} AND owner = ${owner.toLowerCase()}
    ORDER BY ticket_id DESC LIMIT ${limit}`;
}

/** Fills and closes still waiting for their print, older than `staleSec` (the relay normally does them in ~1 s). */
export async function pendingFills(db: Db, chainId: ChainId, nowSec: number, staleSec: number): Promise<TicketRow[]> {
  return db<TicketRow[]>`SELECT * FROM market_tickets WHERE chain_id = ${chainId}
    AND state IN ('committed', 'closing') AND target IS NOT NULL AND target < ${nowSec - staleSec}
    ORDER BY target LIMIT 256`;
}

/** Windows past expiry (plus `afterSec`) that still have unsettled tickets, with those tickets' ids. */
export async function windowsToSettle(db: Db, chainId: ChainId, nowSec: number, afterSec: number) {
  return db<{ window_id: string; series_id: string; window_expiry: bigint; ids: bigint[] }[]>`
    SELECT window_id, series_id, window_expiry, array_agg(ticket_id ORDER BY ticket_id) AS ids
    FROM market_tickets WHERE chain_id = ${chainId} AND state IN ('committed', 'open', 'closing')
      AND window_expiry < ${nowSec - afterSec}
    GROUP BY window_id, series_id, window_expiry ORDER BY window_expiry LIMIT 16`;
}
