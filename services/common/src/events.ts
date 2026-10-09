import type { EventChange, Hex } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import type { Db } from "./db.ts";

/**
 * The services' yes/no book (`market_events`, `event_answers`, `event_calls`; S8.7, D-296): the keeper writes a game
 * as `listing` before its transaction, then the book's own events in receipts the services sent drive everything.
 * Every applied change is announced on `EVENT_CHANNEL`; the api pushes it to the public `markets` topic (the board's
 * pools) and to the caller's stream.
 */
export const EVENT_CHANNEL = "market_event";

/** A side of a game as the apps show it. */
export interface EventTeam {
  name: string;
  abbr: string;
  logo: string | null;
}

export interface EventRow {
  event_id: string;
  league: string;
  game_key: string;
  question: string;
  rules: string;
  terms_hash: string;
  home: EventTeam;
  away: EventTeam;
  starts_at: bigint;
  closes_at: bigint;
  answer_from: bigint;
  answer_by: bigint;
  fee_bps: number;
  committee_id: number;
  state: "listing" | "open" | "decided" | "voided";
  yes_pool: bigint;
  no_pool: bigint;
  calls: number;
  answer: boolean | null;
  void_reason: string | null;
  fee: bigint | null;
  prize: bigint | null;
  decided_at: Date | null;
  listed_tx: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface EventAnswerRow {
  event_id: string;
  member: string;
  yes: boolean;
  statement: string;
  statement_hash: string;
  attested_at: bigint;
  signature: string;
  posted: boolean;
  tx_hash: string | null;
}

export interface EventCallRow {
  ticket_id: bigint;
  event_id: string;
  owner: string;
  yes: boolean;
  stake: bigint;
  status: "open" | "won" | "lost" | "refunded";
  amount: bigint | null;
  call_tx: string | null;
  paid_tx: string | null;
  created_at: Date;
}

export interface EventNotice {
  chainId: ChainId;
  eventId: string;
  change: EventChange["kind"];
  /** The caller, for a call or a payout (their stream hears of it). */
  owner: string | null;
  state: string;
  yesPool: string;
  noPool: string;
  txHash: Hex | null;
}

export interface NewListing {
  eventId: Hex;
  league: string;
  gameKey: string;
  question: string;
  rules: string;
  termsHash: Hex;
  home: EventTeam;
  away: EventTeam;
  startsAt: number;
  closesAt: number;
  answerFrom: number;
  answerBy: number;
  feeBps: number;
  committeeId: number;
}

/** A game the keeper is about to list (kept if a run stops between this and the receipt). */
export async function insertListing(db: Db, chainId: ChainId, l: NewListing): Promise<void> {
  await db`INSERT INTO market_events (chain_id, event_id, league, game_key, question, rules, terms_hash, home, away,
      starts_at, closes_at, answer_from, answer_by, fee_bps, committee_id, state)
    VALUES (${chainId}, ${l.eventId}, ${l.league}, ${l.gameKey}, ${l.question}, ${l.rules}, ${l.termsHash},
      ${JSON.stringify(l.home)}::jsonb, ${JSON.stringify(l.away)}::jsonb, ${l.startsAt}, ${l.closesAt},
      ${l.answerFrom}, ${l.answerBy}, ${l.feeBps}, ${l.committeeId}, 'listing')
    ON CONFLICT DO NOTHING`;
}

/** The games of a league already listed (or being listed), by their key. */
export async function listedGameKeys(db: Db, chainId: ChainId, league: string, keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const rows = await db<{ game_key: string }[]>`SELECT game_key FROM market_events
    WHERE chain_id = ${chainId} AND league = ${league} AND game_key IN ${db(keys)}`;
  return new Set(rows.map((r) => r.game_key));
}

/** Listings whose transaction never landed (a stop between the row and the receipt, or a refused batch). */
export async function staleListings(db: Db, chainId: ChainId, staleSec: number): Promise<EventRow[]> {
  return db<EventRow[]>`SELECT * FROM market_events WHERE chain_id = ${chainId} AND state = 'listing'
    AND created_at < now() - make_interval(secs => ${staleSec}) ORDER BY created_at LIMIT 32`;
}

/** Drops a listing the chain never took and that can't be listed any more (its calls would already be closed). */
export async function dropListing(db: Db, chainId: ChainId, eventId: string): Promise<void> {
  await db`DELETE FROM market_events WHERE chain_id = ${chainId} AND event_id = ${eventId} AND state = 'listing'`;
}

/** A member's signed answer, kept before it is relayed (the statement is what its hash commits to). */
export async function saveAnswer(
  db: Db,
  chainId: ChainId,
  a: Omit<EventAnswerRow, "posted" | "tx_hash">,
): Promise<void> {
  await db`INSERT INTO event_answers (chain_id, event_id, member, yes, statement, statement_hash, attested_at, signature)
    VALUES (${chainId}, ${a.event_id}, ${a.member.toLowerCase()}, ${a.yes}, ${a.statement}, ${a.statement_hash},
      ${a.attested_at}, ${a.signature})
    ON CONFLICT DO NOTHING`;
}

/** Applies the book's changes in order and announces each. */
export async function applyEventChanges(
  db: Db,
  chainId: ChainId,
  changes: readonly EventChange[],
  txHash: Hex | null = null,
): Promise<void> {
  for (const c of changes) {
    let owner: string | null = null;
    switch (c.kind) {
      case "listed":
        await db`UPDATE market_events SET state = 'open', listed_tx = ${txHash}, updated_at = now()
          WHERE chain_id = ${chainId} AND event_id = ${c.eventId} AND state = 'listing'`;
        break;
      case "called":
        owner = c.owner.toLowerCase();
        await db`INSERT INTO event_calls (chain_id, ticket_id, event_id, owner, yes, stake, call_tx)
          VALUES (${chainId}, ${c.ticketId}, ${c.eventId}, ${owner}, ${c.yes}, ${c.stake}, ${txHash})
          ON CONFLICT DO NOTHING`;
        await db`UPDATE market_events SET yes_pool = ${c.yesPool}, no_pool = ${c.noPool},
          calls = (SELECT count(*) FROM event_calls WHERE chain_id = ${chainId} AND event_id = ${c.eventId}),
          updated_at = now() WHERE chain_id = ${chainId} AND event_id = ${c.eventId}`;
        break;
      case "answered":
        await db`UPDATE event_answers SET posted = true, tx_hash = ${txHash}
          WHERE chain_id = ${chainId} AND event_id = ${c.eventId} AND member = ${c.member.toLowerCase()}`;
        await db`UPDATE market_events SET updated_at = now() WHERE chain_id = ${chainId} AND event_id = ${c.eventId}`;
        break;
      case "decided":
        await db`UPDATE market_events SET state = 'decided', answer = ${c.yes}, fee = ${c.fee}, prize = ${c.prize},
          decided_at = now(), updated_at = now() WHERE chain_id = ${chainId} AND event_id = ${c.eventId}`;
        break;
      case "voided":
        await db`UPDATE market_events SET state = 'voided', void_reason = ${c.reason},
          answer = ${c.reason === "no-winners" ? c.answer : null}, decided_at = now(), updated_at = now()
          WHERE chain_id = ${chainId} AND event_id = ${c.eventId}`;
        break;
      case "paid":
        owner = c.owner.toLowerCase();
        await db`UPDATE event_calls SET status = ${c.outcome === "won" ? "won" : c.outcome === "lost" ? "lost" : "refunded"},
          amount = ${c.amount}, paid_tx = ${txHash}, updated_at = now()
          WHERE chain_id = ${chainId} AND ticket_id = ${c.ticketId}`;
        break;
      case "feesSwept":
        continue;
    }
    await announce(db, chainId, c.eventId, c.kind, owner, txHash);
  }
}

async function announce(
  db: Db,
  chainId: ChainId,
  eventId: string,
  change: EventChange["kind"],
  owner: string | null,
  txHash: Hex | null,
): Promise<void> {
  const [row] = await db<Pick<EventRow, "state" | "yes_pool" | "no_pool">[]>`
    SELECT state, yes_pool, no_pool FROM market_events WHERE chain_id = ${chainId} AND event_id = ${eventId}`;
  if (!row) return;
  const notice: EventNotice = {
    chainId,
    eventId,
    change,
    owner,
    state: row.state,
    yesPool: row.yes_pool.toString(),
    noPool: row.no_pool.toString(),
    txHash,
  };
  await db`SELECT pg_notify(${EVENT_CHANNEL}, ${JSON.stringify(notice)})`;
}

// ------------------------------------------------------------------------------------------------ reads

/** The board: open events, soonest close first, then the ones decided in the last `recentSec`. */
export async function eventBoard(db: Db, chainId: ChainId, recentSec: number, limit: number): Promise<EventRow[]> {
  return db<EventRow[]>`SELECT * FROM market_events WHERE chain_id = ${chainId}
    AND (state = 'open' OR (state IN ('decided', 'voided') AND decided_at > now() - make_interval(secs => ${recentSec})))
    ORDER BY (state = 'open') DESC, closes_at ASC LIMIT ${limit}`;
}

export async function eventById(db: Db, chainId: ChainId, eventId: string): Promise<EventRow | undefined> {
  const [row] = await db<EventRow[]>`SELECT * FROM market_events
    WHERE chain_id = ${chainId} AND event_id = ${eventId} AND state <> 'listing'`;
  return row;
}

export async function answersOf(db: Db, chainId: ChainId, eventId: string): Promise<EventAnswerRow[]> {
  return db<EventAnswerRow[]>`SELECT * FROM event_answers WHERE chain_id = ${chainId} AND event_id = ${eventId}
    ORDER BY attested_at`;
}

/** A caller's calls, newest first, with the question each was on. */
export async function eventCallsOf(
  db: Db,
  chainId: ChainId,
  owner: string,
  limit: number,
): Promise<(EventCallRow & { question: string; state: string; answer: boolean | null })[]> {
  return db`SELECT c.*, e.question, e.state, e.answer FROM event_calls c
    JOIN market_events e ON e.chain_id = c.chain_id AND e.event_id = c.event_id
    WHERE c.chain_id = ${chainId} AND c.owner = ${owner.toLowerCase()} ORDER BY c.created_at DESC LIMIT ${limit}`;
}

/** Events the keeper may have to move: open ones whose answers can count, newest close first. */
export async function eventWork(db: Db, chainId: ChainId, now: number, limit: number): Promise<EventRow[]> {
  return db<EventRow[]>`SELECT * FROM market_events WHERE chain_id = ${chainId} AND state = 'open'
    AND answer_from <= ${now} ORDER BY answer_from LIMIT ${limit}`;
}

/** Answers signed but not yet on chain. */
export async function unpostedAnswers(db: Db, chainId: ChainId, limit: number): Promise<EventAnswerRow[]> {
  return db<EventAnswerRow[]>`SELECT a.* FROM event_answers a JOIN market_events e
    ON e.chain_id = a.chain_id AND e.event_id = a.event_id
    WHERE a.chain_id = ${chainId} AND NOT a.posted AND e.state = 'open' ORDER BY a.created_at LIMIT ${limit}`;
}

/** Calls on decided or voided events not yet paid out. */
export async function callsToPay(db: Db, chainId: ChainId, limit: number): Promise<bigint[]> {
  const rows = await db<{ ticket_id: bigint }[]>`SELECT c.ticket_id FROM event_calls c JOIN market_events e
    ON e.chain_id = c.chain_id AND e.event_id = c.event_id
    WHERE c.chain_id = ${chainId} AND c.status = 'open' AND e.state IN ('decided', 'voided')
    ORDER BY c.ticket_id LIMIT ${limit}`;
  return rows.map((r) => r.ticket_id);
}

/** A listing the chain has (its receipt was never applied here). */
export async function adoptListing(db: Db, chainId: ChainId, eventId: string): Promise<void> {
  await db`UPDATE market_events SET state = 'open', updated_at = now()
    WHERE chain_id = ${chainId} AND event_id = ${eventId} AND state = 'listing'`;
  await announce(db, chainId, eventId, "listed", null, null);
}

/** A verdict the chain has that this book missed (someone else resolved it): the state and answer as the chain says. */
export async function adoptVerdict(
  db: Db,
  chainId: ChainId,
  eventId: string,
  v: { state: "decided" | "voided"; answer: boolean; voidReason: string },
): Promise<void> {
  const decided = v.state === "decided";
  await db`UPDATE market_events SET state = ${v.state}, answer = ${decided || v.voidReason === "no-winners" ? v.answer : null},
    void_reason = ${decided ? null : v.voidReason}, decided_at = now(), updated_at = now()
    WHERE chain_id = ${chainId} AND event_id = ${eventId} AND state = 'open'`;
  await announce(db, chainId, eventId, decided ? "decided" : "voided", null, null);
}

/** An answer the chain already holds (relayed in a batch whose receipt wasn't applied). */
export async function markAnswerPosted(db: Db, chainId: ChainId, eventId: string, member: string): Promise<void> {
  await db`UPDATE event_answers SET posted = true
    WHERE chain_id = ${chainId} AND event_id = ${eventId} AND member = ${member.toLowerCase()}`;
}
