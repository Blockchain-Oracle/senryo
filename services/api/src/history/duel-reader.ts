import { type ChainId, TESTNET_CHAIN_ID } from "@senryo/config";
import type { Db } from "@senryo/service-common";
import { LEADERBOARD_SIZE } from "./constants.ts";

/**
 * Duel ratings from the indexer (D-294: Elo ranks on the indexer): the matchmaker's ratings for the queue, a player's
 * record and the ladder (handles only for profiles listed on that network, as the leaderboard).
 */
export interface DuelRatingRow {
  rating: number;
  played: number;
  wins: number;
  losses: number;
  ties: number;
}

export class DuelReader {
  constructor(
    private readonly db: Db,
    private readonly schema: string,
  ) {}

  private get table() {
    return this.db`${this.db(this.schema)}.${this.db("DuelRating")}`;
  }

  /** Ratings of the owners who have played; the others start at the default. */
  async ratings(chainId: ChainId, owners: string[]): Promise<Map<string, number>> {
    if (owners.length === 0) return new Map();
    const rows = await this.db<{ owner: string; rating: number }[]>`SELECT owner, rating FROM ${this.table}
      WHERE "chainId" = ${chainId} AND owner IN ${this.db(owners.map((o) => o.toLowerCase()))}`;
    return new Map(rows.map((r) => [r.owner.toLowerCase(), r.rating]));
  }

  async rating(chainId: ChainId, owner: string): Promise<DuelRatingRow | undefined> {
    const [row] = await this.db<DuelRatingRow[]>`SELECT rating, played, wins, losses, ties FROM ${this.table}
      WHERE "chainId" = ${chainId} AND owner = ${owner.toLowerCase()}`;
    return row;
  }

  async ladder(chainId: ChainId) {
    const listed = chainId === TESTNET_CHAIN_ID ? this.db`p.listed_practice` : this.db`p.listed_mainnet`;
    return this.db<(DuelRatingRow & { owner: string; handle: string | null })[]>`
      SELECT r.owner, CASE WHEN ${listed} AND NOT p.hidden THEN p.handle END AS handle, r.rating, r.played, r.wins,
             r.losses, r.ties
      FROM ${this.table} r LEFT JOIN profiles p ON p.address = r.owner
      WHERE r."chainId" = ${chainId} AND r.played > 0 ORDER BY r.rating DESC, r.played DESC LIMIT ${LEADERBOARD_SIZE}`;
  }
}
