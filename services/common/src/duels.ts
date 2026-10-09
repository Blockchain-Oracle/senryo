import type { Address, DuelChange, Hex } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import type { Db } from "./db.ts";

/**
 * The services' duel book (`duel_matches`, `duel_picks`; S8.6, D-294): written when the matchmaker pairs two entries
 * (state `opening`, with the deck and its server seed), then driven only by the arena's own events in receipts the
 * services sent. Every applied change is announced on `DUEL_CHANNEL`; the api pushes it to both players' streams.
 */
export const DUEL_CHANNEL = "duel_match";

/** A card of the deck: its window and what the apps show of it. */
export interface DuelCardRef {
  windowId: Hex;
  seriesId: Hex;
  symbol: string;
  cadenceSec: number;
  start: number;
  expiry: number;
}

export interface DuelMatchRow {
  match_id: string;
  tier: number;
  player_a: string;
  player_b: string;
  pot: bigint;
  card_stake: bigint;
  server_seed: string;
  deck_hash: string;
  cards: DuelCardRef[];
  state: string;
  reveal_by: bigint | null;
  pick_deadline: bigint | null;
  winner: string | null;
  result_a: bigint | null;
  result_b: bigint | null;
  reason: string | null;
  created_at: Date;
  updated_at: Date;
  /** Each seat's swipe key, from its entry. */
  key_a: string | null;
  key_b: string | null;
}

export interface DuelPickRow {
  card: number;
  seat: number;
  player: string;
  band: number;
  ticket_id: bigint;
  returned: bigint | null;
  result: bigint | null;
}

export type DuelWithPicks = DuelMatchRow & { picks: DuelPickRow[] };

export interface DuelNotice {
  chainId: ChainId;
  matchId: string;
  change: DuelChange["kind"] | "opening" | "failed" | "pickFilled" | "pickRefused";
  players: [string, string];
  state: string;
  txHash: Hex | null;
}

export interface NewMatch {
  matchId: Hex;
  tier: number;
  playerA: Address;
  playerB: Address;
  pot: bigint;
  cardStake: bigint;
  serverSeed: Hex;
  deckHash: Hex;
  cards: DuelCardRef[];
}

/** The matchmaker's pairing, before the chain has it. */
export async function insertMatch(db: Db, chainId: ChainId, m: NewMatch): Promise<void> {
  await db`INSERT INTO duel_matches (chain_id, match_id, tier, player_a, player_b, pot, card_stake, server_seed,
                                     deck_hash, cards, state)
    VALUES (${chainId}, ${m.matchId}, ${m.tier}, ${m.playerA.toLowerCase()}, ${m.playerB.toLowerCase()}, ${m.pot},
            ${m.cardStake}, ${m.serverSeed}, ${m.deckHash}, ${JSON.stringify(m.cards)}::jsonb, 'opening')
    ON CONFLICT (chain_id, match_id) DO NOTHING`;
  await announce(db, chainId, m.matchId, "opening", null);
}

/** A match the chain never took (its opening reverted) or whose reveal can't happen. */
export async function failMatch(db: Db, chainId: ChainId, matchId: Hex, reason: string): Promise<void> {
  await db`UPDATE duel_matches SET state = 'failed', reason = ${reason}, updated_at = now()
    WHERE chain_id = ${chainId} AND match_id = ${matchId} AND state = 'opening'`;
  await announce(db, chainId, matchId, "failed", null);
}

/** Applies the arena's changes in order. */
export async function applyDuelChanges(
  db: Db,
  chainId: ChainId,
  changes: readonly DuelChange[],
  txHash: Hex | null = null,
): Promise<void> {
  for (const c of changes) {
    const m = c.matchId;
    switch (c.kind) {
      case "matchOpened":
        await db`UPDATE duel_matches SET state = 'sealed', reveal_by = ${c.revealBy}, updated_at = now()
          WHERE chain_id = ${chainId} AND match_id = ${m} AND state = 'opening'`;
        break;
      case "deckRevealed":
        await db`UPDATE duel_matches SET state = 'picking', pick_deadline = ${c.pickDeadline},
                 server_seed = ${c.serverSeed}, updated_at = now() WHERE chain_id = ${chainId} AND match_id = ${m} AND state IN ('opening', 'sealed')`;
        break;
      case "pickPlaced":
        await db`INSERT INTO duel_picks (chain_id, match_id, card, seat, player, band, ticket_id)
          SELECT ${chainId}, ${c.matchId}, ${c.card},
                 CASE WHEN player_a = ${c.player.toLowerCase()} THEN 0 ELSE 1 END,
                 ${c.player.toLowerCase()}, ${c.band}, ${c.ticketId}
          FROM duel_matches WHERE chain_id = ${chainId} AND match_id = ${m}
          ON CONFLICT (chain_id, match_id, card, seat) DO NOTHING`;
        await db`UPDATE duel_matches SET updated_at = now() WHERE chain_id = ${chainId} AND match_id = ${m}`;
        break;
      case "picksLocked":
        await db`UPDATE duel_matches SET state = ${c.state}, updated_at = now() WHERE chain_id = ${chainId} AND match_id = ${m}`;
        break;
      case "budgetReturned":
        break;
      case "cardSettled":
        await db`UPDATE duel_picks SET returned = ${c.returned}, result = ${c.result}
          WHERE chain_id = ${chainId} AND match_id = ${m} AND card = ${c.card} AND player = ${c.player.toLowerCase()}`;
        await db`UPDATE duel_matches SET updated_at = now() WHERE chain_id = ${chainId} AND match_id = ${m}`;
        break;
      case "matchFinalized":
        await db`UPDATE duel_matches SET state = 'finalized', winner = ${c.winner?.toLowerCase() ?? null},
                 result_a = ${c.resultA}, result_b = ${c.resultB}, updated_at = now() WHERE chain_id = ${chainId} AND match_id = ${m}`;
        break;
      case "matchRefunded":
        await db`UPDATE duel_matches SET state = 'refunded', updated_at = now() WHERE chain_id = ${chainId} AND match_id = ${m}`;
        break;
    }
    await announce(db, chainId, c.matchId, c.kind, txHash);
  }
}

/** Tells both players' streams that their match moved (the apps re-read it). */
export async function announce(
  db: Db,
  chainId: ChainId,
  matchId: string,
  change: DuelNotice["change"],
  txHash: Hex | null,
): Promise<void> {
  const [row] = await db<Pick<DuelMatchRow, "player_a" | "player_b" | "state">[]>`
    SELECT player_a, player_b, state FROM duel_matches WHERE chain_id = ${chainId} AND match_id = ${matchId}`;
  if (!row) return;
  const notice: DuelNotice = {
    chainId,
    matchId,
    change,
    players: [row.player_a, row.player_b],
    state: row.state,
    txHash,
  };
  await db`SELECT pg_notify(${DUEL_CHANNEL}, ${JSON.stringify(notice)})`;
}

async function withPicks(db: Db, chainId: ChainId, rows: DuelMatchRow[]): Promise<DuelWithPicks[]> {
  if (rows.length === 0) return [];
  const picks = await db<(DuelPickRow & { match_id: string })[]>`SELECT * FROM duel_picks
    WHERE chain_id = ${chainId} AND match_id IN ${db(rows.map((r) => r.match_id))} ORDER BY card, seat`;
  return rows.map((r) => ({ ...r, picks: picks.filter((p) => p.match_id === r.match_id) }));
}

/** A match row with each seat's key (named in its entry). */
const MATCH_COLUMNS = (db: Db) => db`m.*,
  (SELECT e.body->'entry'->>'delegate' FROM duel_entries e WHERE e.match_id = m.match_id AND e.owner = m.player_a
   LIMIT 1) AS key_a,
  (SELECT e.body->'entry'->>'delegate' FROM duel_entries e WHERE e.match_id = m.match_id AND e.owner = m.player_b
   LIMIT 1) AS key_b`;

/** A player's duels, newest first. */
export async function duelsOf(db: Db, chainId: ChainId, owner: Address, limit: number): Promise<DuelWithPicks[]> {
  const o = owner.toLowerCase();
  const rows = await db<DuelMatchRow[]>`SELECT ${MATCH_COLUMNS(db)} FROM duel_matches m WHERE m.chain_id = ${chainId}
    AND (m.player_a = ${o} OR m.player_b = ${o}) ORDER BY m.created_at DESC LIMIT ${limit}`;
  return withPicks(db, chainId, rows);
}

export async function duelOf(db: Db, chainId: ChainId, matchId: Hex): Promise<DuelWithPicks | undefined> {
  const rows = await db<DuelMatchRow[]>`SELECT ${MATCH_COLUMNS(db)} FROM duel_matches m
    WHERE m.chain_id = ${chainId} AND m.match_id = ${matchId}`;
  return (await withPicks(db, chainId, rows))[0];
}

/** Matches the keeper may have to move: sealed, picking, or with picks still to settle, or a pot still to pay. */
export async function duelWork(db: Db, chainId: ChainId, limit: number): Promise<DuelWithPicks[]> {
  const rows = await db<DuelMatchRow[]>`SELECT ${MATCH_COLUMNS(db)} FROM duel_matches m WHERE m.chain_id = ${chainId}
    AND (m.state IN ('sealed', 'picking', 'settling', 'forfeited')
      OR (m.state = 'refunded' AND EXISTS (SELECT 1 FROM duel_picks p WHERE p.chain_id = m.chain_id
          AND p.match_id = m.match_id AND p.returned IS NULL)))
    ORDER BY m.updated_at LIMIT ${limit}`;
  return withPicks(db, chainId, rows);
}

/** The duel pick a reserve ticket is, with both players (the arena owns the ticket; the player sees it). */
export async function duelPickByTicket(db: Db, chainId: ChainId, ticketId: bigint) {
  const [row] = await db<{ match_id: string; player: string; card: number }[]>`
    SELECT match_id, player, card FROM duel_picks WHERE chain_id = ${chainId} AND ticket_id = ${ticketId}`;
  return row;
}

/** Pairings still `opening` after `staleSec` (the api stopped between pairing and recording the opening). */
export async function staleOpenings(db: Db, chainId: ChainId, staleSec: number): Promise<{ match_id: string }[]> {
  return db<{ match_id: string }[]>`SELECT match_id FROM duel_matches WHERE chain_id = ${chainId}
    AND state = 'opening' AND created_at < now() - make_interval(secs => ${staleSec}) LIMIT 16`;
}

/** Adopts what the chain says of a stale opening: sealed (the keeper refunds it after the reveal window) or failed. */
export async function adoptOpening(db: Db, chainId: ChainId, matchId: Hex, sealedUntil: number | null): Promise<void> {
  if (sealedUntil === null) return failMatch(db, chainId, matchId, "the opening never reached the chain");
  await db`UPDATE duel_matches SET state = 'sealed', reveal_by = ${sealedUntil}, updated_at = now()
    WHERE chain_id = ${chainId} AND match_id = ${matchId} AND state = 'opening'`;
  await announce(db, chainId, matchId, "matchOpened", null);
}
