import {
  type Address,
  deckHashOf,
  describeError,
  duelEntryDigest,
  duelEntrySigner,
  type Hex,
  type MarketDuelEntry,
  matchIdOf,
  type PermitArgs,
  type ReadClient,
  readDuelAccount,
  type SignedDuelEntry,
} from "@senryo/chain";
import { type ChainId, DUEL, duelEntryCost, duelTierOf } from "@senryo/config";
import {
  type Db,
  HTTP_STATUS,
  HttpError,
  insertMatch,
  type Logger,
  MS_PER_SECOND,
  nowSec,
} from "@senryo/service-common";
import type { PythGateway } from "../prices/gateway.ts";
import { bad } from "../relay/gates.ts";
import type { StreamBus } from "../stream/bus.ts";
import {
  DEFAULT_RATING,
  MATCHMAKER_TICK_MS,
  MAX_QUEUED_PER_OWNER,
  RATING_BAND_MAX,
  RATING_BAND_START,
  RATING_BAND_STEP,
  RATING_BAND_STEP_SEC,
} from "./constants.ts";
import { candidates, drawDeck, freshSeed } from "./deck.ts";
import type { DuelRelay } from "./relay.ts";

/**
 * The matchmaker (S8.6, D-294): signed entries wait in `duel_entries` (checked on arrival — the owner's signature,
 * epoch, dollars and the arena's allowance or a permit — so a pairing rarely fails on chain); every tick pairs entries
 * of one tier, closest rating first within a band that widens with waiting (Elo from the indexer), draws the deck and
 * hands the pair to the relay. An opening the chain refuses re-checks both: the good entry goes back to the queue.
 */
export interface DuelEntryRequest {
  chainId: ChainId;
  entry: MarketDuelEntry;
  signature: Hex;
  permit: PermitArgs | null;
}

interface EntryRow {
  digest: string;
  owner: string;
  tier: number;
  body: { entry: Record<string, string | number>; signature: Hex; permit: Record<string, string | number> | null };
  deadline: bigint;
  created_at: Date;
}

export interface QueueStatus {
  digest: Hex;
  state: "queued" | "paired" | "cancelled" | "lapsed" | "failed";
  tier: number;
  matchId: Hex | null;
  reason: string | null;
  since: string;
}

/** An entry must still be good this long after pairing, for the opening transaction to land. */
const PAIRING_MARGIN_SEC = 15;
/** The app signs a fresh entry per tap; a deadline further out than the queue's TTL (plus the clock's slack) is odd. */
const DEADLINE_SLACK_SEC = 30;

const toJson = (v: unknown) => JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x)));

function signedOf(row: EntryRow): SignedDuelEntry {
  const e = row.body.entry;
  const p = row.body.permit;
  return {
    entry: {
      owner: e.owner as Address,
      tier: Number(e.tier),
      delegate: e.delegate as Address,
      seed: e.seed as Hex,
      deadline: BigInt(e.deadline as string),
      nonce: BigInt(e.nonce as string),
      epoch: Number(e.epoch),
    },
    signature: row.body.signature,
    permit: p
      ? {
          value: BigInt(p.value as string),
          deadline: BigInt(p.deadline as string),
          v: Number(p.v),
          r: p.r as Hex,
          s: p.s as Hex,
        }
      : null,
  };
}

export class DuelQueue {
  private timer: ReturnType<typeof setInterval> | undefined;
  private busy = false;

  constructor(
    private readonly d: {
      chainId: ChainId;
      read: ReadClient;
      relay: DuelRelay;
      gateway: PythGateway;
      bus: StreamBus;
      db: Db;
      log: Logger;
      ratings: (owners: string[]) => Promise<Map<string, number>>;
    },
  ) {}

  start(): void {
    this.timer = setInterval(() => void this.tick(), MATCHMAKER_TICK_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async enter(req: DuelEntryRequest): Promise<QueueStatus> {
    const { entry } = req;
    const tier = duelTierOf(req.chainId, entry.tier);
    if (!tier) throw bad("no such tier");
    const now = nowSec();
    const deadline = Number(entry.deadline);
    if (deadline <= now + PAIRING_MARGIN_SEC || deadline > now + DUEL.entryTtlSec + DEADLINE_SLACK_SEC) {
      throw bad("the entry's deadline is out of range");
    }
    if (entry.delegate.toLowerCase() === entry.owner.toLowerCase()) throw bad("the seat key is not the owner");
    const signer = await duelEntrySigner(req.chainId, entry, req.signature);
    if (signer.toLowerCase() !== entry.owner.toLowerCase()) throw bad("the entry is not signed by its owner");
    await this.checkAccount(req, duelEntryCost(tier));
    const owner = entry.owner.toLowerCase();
    const [count] = await this.d.db<{ queued: number }[]>`SELECT count(*)::int AS queued FROM duel_entries
      WHERE chain_id = ${this.d.chainId} AND owner = ${owner} AND state = 'queued'`;
    if ((count?.queued ?? 0) >= MAX_QUEUED_PER_OWNER) {
      throw new HttpError(HTTP_STATUS.conflict, "CONFLICT", "you're already waiting for a duel");
    }
    const digest = duelEntryDigest(req.chainId, entry);
    const body = toJson({ entry, signature: req.signature, permit: req.permit });
    await this.d.db`INSERT INTO duel_entries (digest, chain_id, owner, tier, body, deadline)
      VALUES (${digest}, ${this.d.chainId}, ${owner}, ${entry.tier}, ${body}::jsonb, ${deadline})
      ON CONFLICT (digest) DO NOTHING`;
    const status = await this.statusOf(digest);
    this.tell(owner, status);
    void this.tick();
    return status;
  }

  /** Dollars for the pot and every card, the arena's allowance or a permit that covers it, the owner's epoch. */
  private async checkAccount(req: DuelEntryRequest, cost: bigint): Promise<void> {
    const a = await readDuelAccount(this.d.read, req.chainId, req.entry.owner);
    if (a.epoch !== req.entry.epoch) throw bad("the entry was signed before a revoke");
    if (a.balance < cost) throw new HttpError(HTTP_STATUS.conflict, "CONFLICT", "not enough dollars for this tier");
    const permitted = req.permit && req.permit.value >= cost && req.permit.deadline >= req.entry.deadline;
    if (!permitted && a.allowance < cost) throw bad("the entry needs a permit for its dollars");
  }

  async cancel(owner: Address, digest: Hex): Promise<QueueStatus> {
    const rows = await this.d.db`UPDATE duel_entries SET state = 'cancelled', updated_at = now()
      WHERE digest = ${digest} AND owner = ${owner.toLowerCase()} AND state = 'queued' RETURNING digest`;
    if (rows.length === 0) throw new HttpError(HTTP_STATUS.conflict, "CONFLICT", "this entry is no longer waiting");
    const status = await this.statusOf(digest);
    this.tell(owner.toLowerCase(), status);
    return status;
  }

  /** The owner's newest entry on this network. */
  async latest(owner: Address): Promise<QueueStatus | null> {
    const [row] = await this.d.db<
      { digest: string }[]
    >`SELECT digest FROM duel_entries WHERE chain_id = ${this.d.chainId}
      AND owner = ${owner.toLowerCase()} ORDER BY created_at DESC LIMIT 1`;
    return row ? this.statusOf(row.digest as Hex) : null;
  }

  private async statusOf(digest: Hex): Promise<QueueStatus> {
    const [r] = await this.d.db<
      {
        digest: string;
        state: QueueStatus["state"];
        tier: number;
        match_id: string | null;
        reason: string | null;
        created_at: Date;
      }[]
    >`SELECT digest, state, tier, match_id, reason, created_at FROM duel_entries WHERE digest = ${digest}`;
    if (!r) throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", "no such entry");
    return {
      digest: r.digest as Hex,
      state: r.state,
      tier: r.tier,
      matchId: r.match_id as Hex | null,
      reason: r.reason,
      since: r.created_at.toISOString(),
    };
  }

  /** The device key a player's entry in this match named (it may sign their swipes). */
  async seatKey(matchId: Hex, player: string): Promise<string | null> {
    const [row] = await this.d.db<{ delegate: string | null }[]>`SELECT body->'entry'->>'delegate' AS delegate
      FROM duel_entries WHERE match_id = ${matchId} AND owner = ${player.toLowerCase()} LIMIT 1`;
    return row?.delegate?.toLowerCase() ?? null;
  }

  private tell(owner: string, status: QueueStatus): void {
    this.d.bus.emit(`user:${owner}`, "duelQueue", status);
  }

  // ------------------------------------------------------------------------------------------------ pairing

  private async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.lapse();
      const rows = await this.d.db<EntryRow[]>`SELECT digest, owner, tier, body, deadline, created_at FROM duel_entries
        WHERE chain_id = ${this.d.chainId} AND state = 'queued' ORDER BY created_at`;
      const tiers = new Map<number, EntryRow[]>();
      for (const r of rows) tiers.set(r.tier, [...(tiers.get(r.tier) ?? []), r]);
      for (const waiting of tiers.values()) {
        if (waiting.length < 2) continue;
        const ratings = await this.d.ratings(waiting.map((w) => w.owner)).catch(() => new Map<string, number>());
        for (const [a, b] of pairsOf(waiting, ratings, nowSec())) await this.pair(a, b);
      }
    } catch (error) {
      this.d.log.warn({ err: describeError(error) }, "matchmaker tick failed");
    } finally {
      this.busy = false;
    }
  }

  private async lapse(): Promise<void> {
    const lapsed = await this.d.db<{ digest: string; owner: string }[]>`UPDATE duel_entries SET state = 'lapsed',
      updated_at = now() WHERE chain_id = ${this.d.chainId} AND state = 'queued'
      AND deadline < ${nowSec() + PAIRING_MARGIN_SEC} RETURNING digest, owner`;
    for (const l of lapsed) this.tell(l.owner, await this.statusOf(l.digest as Hex));
  }

  private async pair(a: EntryRow, b: EntryRow): Promise<void> {
    const sa = signedOf(a);
    const sb = signedOf(b);
    const seeds = [sa.entry.seed, sb.entry.seed] as const;
    const serverSeed = freshSeed();
    const deck = drawDeck(candidates(this.d.chainId, nowSec(), this.d.gateway), serverSeed, seeds);
    if (!deck) return; // too little time left in every window: the next one opens shortly
    const matchId = matchIdOf(a.digest as Hex, b.digest as Hex);
    const cards = deck.map((c) => c.windowId) as [Hex, Hex, Hex];
    const deckHash = deckHashOf(this.d.chainId, matchId, serverSeed, seeds, cards);
    const taken = await this.d.db`UPDATE duel_entries SET state = 'paired', match_id = ${matchId}, updated_at = now()
      WHERE digest IN ${this.d.db([a.digest, b.digest])} AND state = 'queued' RETURNING digest`;
    if (taken.length !== 2) {
      // One left the queue meanwhile (cancelled): the other keeps its place.
      await this.d.db`UPDATE duel_entries SET state = 'queued', match_id = NULL, updated_at = now()
        WHERE match_id = ${matchId} AND state = 'paired'`;
      return;
    }
    const tier = duelTierOf(this.d.chainId, a.tier);
    if (!tier) return;
    await insertMatch(this.d.db, this.d.chainId, {
      matchId,
      tier: a.tier,
      playerA: sa.entry.owner,
      playerB: sb.entry.owner,
      pot: tier.pot,
      cardStake: tier.cardStake,
      serverSeed,
      deckHash,
      cards: deck,
    });
    for (const r of [a, b]) this.tell(r.owner, await this.statusOf(r.digest as Hex));
    this.d.log.info({ actor: "duel", why: "pair", match: matchId, tier: a.tier }, "duel paired");
    const opened = await this.d.relay.open(matchId, sa, sb, deckHash);
    if (!opened) await this.recheck([a, b]);
  }

  /** After a refused opening: an entry that still holds goes back to the queue (keeping its place), else it fails. */
  private async recheck(rows: EntryRow[]): Promise<void> {
    for (const r of rows) {
      const signed = signedOf(r);
      const tier = duelTierOf(this.d.chainId, r.tier);
      const reason = await this.checkAccount({ chainId: this.d.chainId, ...signed }, tier ? duelEntryCost(tier) : 0n)
        .then(() => null)
        .catch((error: Error) => error.message);
      await this.d.db`UPDATE duel_entries SET state = ${reason ? "failed" : "queued"}, match_id = NULL,
        reason = ${reason}, updated_at = now() WHERE digest = ${r.digest}`;
      this.tell(r.owner, await this.statusOf(r.digest as Hex));
    }
  }
}

/** How far apart two ratings may be for an entry that has waited `waitedSec`. */
const bandOf = (waitedSec: number) =>
  Math.min(RATING_BAND_MAX, RATING_BAND_START + RATING_BAND_STEP * Math.floor(waitedSec / RATING_BAND_STEP_SEC));

/** Oldest first, each with the closest rating both bands allow (another owner); beyond the widest band, anyone. */
function pairsOf(waiting: EntryRow[], ratings: Map<string, number>, now: number): [EntryRow, EntryRow][] {
  const rating = (r: EntryRow) => ratings.get(r.owner) ?? DEFAULT_RATING;
  const waited = (r: EntryRow) => now - Math.floor(r.created_at.getTime() / MS_PER_SECOND);
  const taken = new Set<string>();
  const out: [EntryRow, EntryRow][] = [];
  for (const a of waiting) {
    if (taken.has(a.digest)) continue;
    let best: EntryRow | undefined;
    for (const b of waiting) {
      if (b === a || taken.has(b.digest) || b.owner === a.owner) continue;
      const gap = Math.abs(rating(a) - rating(b));
      const widest = Math.min(bandOf(waited(a)), bandOf(waited(b)));
      const anyone = waited(a) >= RATING_BAND_STEP_SEC * (RATING_BAND_MAX / RATING_BAND_STEP);
      if (gap > widest && !anyone) continue;
      if (!best || gap < Math.abs(rating(a) - rating(best))) best = b;
    }
    if (!best) continue;
    taken.add(a.digest);
    taken.add(best.digest);
    out.push([a, best]);
  }
  return out;
}
