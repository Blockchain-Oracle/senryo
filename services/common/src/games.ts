import type { ChainId } from "@senryo/config";
import { type Db, jsonb } from "./db.ts";

/** Lucky draws and arcade runs (S8.8, D-295): the api's own records, no chain. */

/** What a reveal dealt: the window, the band and the price it would fill at when dealt. */
export interface LuckyDealt {
  windowId: string;
  symbol: string;
  cadenceSec: number;
  start: number;
  expiry: number;
  band: number;
  priceE6: string;
}

export interface LuckyDrawRow {
  draw_id: string;
  owner: string;
  server_seed: string;
  commitment: string;
  markets: string[];
  markets_hash: string;
  client_seed: string | null;
  digest: string | null;
  symbol: string | null;
  side: string | null;
  reach: number | null;
  dealt: LuckyDealt | null;
  ticket_id: bigint | null;
  sealed_at: Date;
  revealed_at: Date | null;
}

export async function insertLuckySeal(
  db: Db,
  chainId: ChainId,
  d: { drawId: string; owner: string; serverSeed: string; commitment: string; markets: string[]; marketsHash: string },
): Promise<void> {
  await db`INSERT INTO lucky_draws (draw_id, chain_id, owner, server_seed, commitment, markets, markets_hash)
    VALUES (${d.drawId}, ${chainId}, ${d.owner.toLowerCase()}, ${d.serverSeed}, ${d.commitment},
      ${jsonb(db, d.markets)}, ${d.marketsHash})`;
}

export async function luckyDrawById(db: Db, chainId: ChainId, drawId: string): Promise<LuckyDrawRow | undefined> {
  const [row] = await db<LuckyDrawRow[]>`SELECT * FROM lucky_draws WHERE chain_id = ${chainId} AND draw_id = ${drawId}`;
  return row;
}

/** Records the reveal once (a second reveal of the same draw changes nothing). */
export async function recordLuckyReveal(
  db: Db,
  chainId: ChainId,
  drawId: string,
  r: { clientSeed: string; digest: string; symbol: string; side: string; reach: number; dealt: LuckyDealt | null },
): Promise<boolean> {
  const rows =
    await db`UPDATE lucky_draws SET client_seed = ${r.clientSeed}, digest = ${r.digest}, symbol = ${r.symbol},
      side = ${r.side}, reach = ${r.reach}, dealt = ${r.dealt === null ? null : jsonb(db, r.dealt)},
      revealed_at = now()
    WHERE chain_id = ${chainId} AND draw_id = ${drawId} AND revealed_at IS NULL RETURNING draw_id`;
  return rows.length > 0;
}

export async function linkLuckyTicket(
  db: Db,
  chainId: ChainId,
  drawId: string,
  owner: string,
  ticketId: bigint,
): Promise<void> {
  await db`UPDATE lucky_draws SET ticket_id = ${ticketId}
    WHERE chain_id = ${chainId} AND draw_id = ${drawId} AND owner = ${owner.toLowerCase()} AND ticket_id IS NULL`;
}

export async function luckyDrawsOf(db: Db, chainId: ChainId, owner: string, limit: number): Promise<LuckyDrawRow[]> {
  return db<LuckyDrawRow[]>`SELECT * FROM lucky_draws WHERE chain_id = ${chainId} AND owner = ${owner.toLowerCase()}
    AND revealed_at IS NOT NULL ORDER BY sealed_at DESC LIMIT ${limit}`;
}

/** Seals issued to an owner in the last `sec` (the spin limit). */
export async function recentLuckySeals(db: Db, owner: string, sec: number): Promise<number> {
  const [row] = await db<{ n: number }[]>`SELECT count(*)::int AS n FROM lucky_draws
    WHERE owner = ${owner.toLowerCase()} AND sealed_at > now() - make_interval(secs => ${sec})`;
  return row?.n ?? 0;
}

// ------------------------------------------------------------------------------------------------ arcade

export interface ArcadeTapeRow {
  id: string;
  symbol: string;
  fromMinute: number;
  openE8: bigint;
  moves: number[];
}

/** Keeps a price tape once (its id is the symbol and first minute, so the same tape is never stored twice). */
export async function saveArcadeTape(db: Db, t: ArcadeTapeRow): Promise<void> {
  await db`INSERT INTO arcade_tapes (id, symbol, from_minute, open_e8, moves)
    VALUES (${t.id}, ${t.symbol}, ${t.fromMinute}, ${t.openE8}, ${t.moves}) ON CONFLICT (id) DO NOTHING`;
}

export async function issueArcadeSeed(
  db: Db,
  s: { seed: string; game: string; owner: string; engine: number; tape: string },
): Promise<void> {
  await db`INSERT INTO arcade_seeds (seed, game, owner, engine, tape)
    VALUES (${s.seed}, ${s.game}, ${s.owner.toLowerCase()}, ${s.engine}, ${s.tape})`;
}

/**
 * Takes a seed for one score: it must be this owner's, for this game, unused and younger than `maxAgeSec`. Returns the
 * engine the seed was issued for and its tape's moves (the replay runs that engine on that line), or null.
 */
export async function takeArcadeSeed(
  db: Db,
  seed: string,
  game: string,
  owner: string,
  maxAgeSec: number,
): Promise<{ engine: number; moves: number[] } | null> {
  const rows = await db<{ engine: number; moves: number[] | null }[]>`WITH taken AS (
      UPDATE arcade_seeds SET used = true WHERE seed = ${seed} AND game = ${game}
      AND owner = ${owner.toLowerCase()} AND NOT used AND issued_at > now() - make_interval(secs => ${maxAgeSec})
      RETURNING engine, tape)
    SELECT taken.engine, t.moves FROM taken LEFT JOIN arcade_tapes t ON t.id = taken.tape`;
  const row = rows[0];
  return row ? { engine: row.engine, moves: row.moves ?? [] } : null;
}

export async function insertArcadeScore(
  db: Db,
  s: { game: string; owner: string; seed: string; calm: boolean; score: number; ticks: number; engine: number },
): Promise<void> {
  await db`INSERT INTO arcade_scores (game, owner, seed, calm, score, ticks, engine)
    VALUES (${s.game}, ${s.owner.toLowerCase()}, ${s.seed}, ${s.calm}, ${s.score}, ${s.ticks}, ${s.engine})`;
}

export interface ArcadeBoardRow {
  owner: string;
  handle: string | null;
  avatar: string | null;
  score: number;
  calm: boolean;
  created_at: Date;
}

/** Each player's best run, top first (a handle and portrait when the player has a profile). */
export async function arcadeBoard(db: Db, game: string, engine: number, limit: number): Promise<ArcadeBoardRow[]> {
  return db<ArcadeBoardRow[]>`SELECT DISTINCT ON (s.owner) s.owner, p.handle, p.avatar, s.score, s.calm, s.created_at
    FROM arcade_scores s LEFT JOIN profiles p ON p.address = s.owner
    WHERE s.game = ${game} AND s.engine = ${engine} ORDER BY s.owner, s.score DESC, s.created_at`.then((rows) =>
    rows.sort((a, b) => b.score - a.score || a.created_at.getTime() - b.created_at.getTime()).slice(0, limit),
  );
}

export async function arcadeBestOf(db: Db, game: string, engine: number, owner: string): Promise<number | null> {
  const [row] = await db<{ score: number }[]>`SELECT max(score)::int AS score FROM arcade_scores
    WHERE game = ${game} AND engine = ${engine} AND owner = ${owner.toLowerCase()}`;
  return row?.score ?? null;
}
