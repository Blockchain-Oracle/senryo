import { WINDOW_CALLS_MAX } from "@senryo/api-client";
import { type Hex, seriesIdOf, seriesOf } from "@senryo/chain";
import { type ChainId, feedIdOf, marketsOn, TESTNET_CHAIN_ID } from "@senryo/config";
import { type Db, nowSec } from "@senryo/service-common";
import { CALLS_PAGE, DAYS_PER_WEEK, LEADERBOARD_SIZE, SECONDS_PER_DAY, WINDOWS_PAGE } from "./constants.ts";

/**
 * The indexer's tables over SQL (S4, D-272): Envio writes them in its own schema of the shared Postgres (Hasura is
 * off); the api only reads. Every query filters on `chainId` — Practice and Real rows never mix (D-173).
 */
interface TicketRow {
  ticketId: bigint;
  windowId: string;
  band: number;
  status: string;
  originalStake: bigint;
  payout: bigint;
  entryE8: bigint | null;
  proceeds: bigint;
  paid: bigint;
  refunded: bigint;
  outcome: string | null;
  viaSession: boolean;
  committedAt: number;
  committedTx: string;
  fillTx: string | null;
  claimTx: string | null;
  seriesId: string;
  start: number;
}

const FINISHED = new Set(["closed", "settled", "refunded"]);

/** Every series id of a market on this network (one per cadence). */
function seriesIdsOf(chainId: ChainId, symbol: string): Hex[] {
  const m = marketsOn(chainId).find((x) => x.symbol === symbol);
  return m ? m.cadences.map((c) => seriesIdOf(symbol, c)) : [];
}

/** Envio stores BigInt as `numeric`; money fits int8, which the client reads as bigint. */
const TICKET_COLUMNS = `t."ticketId"::int8 AS "ticketId", t."windowId", t.band, t.status,
  t."originalStake"::int8 AS "originalStake", t.payout::int8 AS payout, t."entryE8"::int8 AS "entryE8",
  t.proceeds::int8 AS proceeds, t.paid::int8 AS paid, t.refunded::int8 AS refunded, t.outcome, t."viaSession",
  t."committedAt", t."committedTx", t."fillTx", t."claimTx", w."seriesId", w.start`;

export class IndexerReader {
  constructor(
    private readonly db: Db,
    private readonly schema: string,
  ) {}

  private t(name: string) {
    return this.db`${this.db(this.schema)}.${this.db(name)}`;
  }

  async calls(chainId: ChainId, owner: string, before?: bigint) {
    const rows = await this.db<TicketRow[]>`
      SELECT ${this.db.unsafe(TICKET_COLUMNS)}
      FROM ${this.t("Ticket")} t JOIN ${this.t("Window")} w ON w.id = t."chainId" || '_' || t."windowId"
      WHERE t."chainId" = ${chainId} AND t.owner = ${owner.toLowerCase()}
        ${before === undefined ? this.db`` : this.db`AND t."ticketId" < ${before}`}
      ORDER BY t."ticketId" DESC LIMIT ${CALLS_PAGE}`;
    const calls = rows.flatMap((r) => this.toCall(chainId, r));
    const last = rows.at(-1);
    return { calls, next: rows.length === CALLS_PAGE && last ? String(last.ticketId) : null };
  }

  async call(chainId: ChainId, ticketId: bigint) {
    const [row] = await this.db<TicketRow[]>`
      SELECT ${this.db.unsafe(TICKET_COLUMNS)}
      FROM ${this.t("Ticket")} t JOIN ${this.t("Window")} w ON w.id = t."chainId" || '_' || t."windowId"
      WHERE t."chainId" = ${chainId} AND t."ticketId" = ${ticketId}`;
    if (!row) return undefined;
    const events = await this.db<
      { kind: string; amount: bigint; priceE8: bigint | null; timestamp: number; txHash: string }[]
    >`
      SELECT kind, amount::int8 AS amount, "priceE8"::int8 AS "priceE8", timestamp, "txHash" FROM ${this.t("TicketEvent")}
      WHERE "chainId" = ${chainId} AND "ticketId" = ${ticketId} ORDER BY timestamp, id`;
    const [call] = this.toCall(chainId, row);
    return call ? { call, events } : undefined;
  }

  async window(chainId: ChainId, windowId: string) {
    const [w] = await this.db<
      {
        seriesId: string;
        start: number;
        expiry: number;
        state: string;
        settled: boolean;
        calls: number;
        volume: bigint;
        bandStake: string[];
        openedTx: string;
        settledTx: string | null;
        resolvedTx: string | null;
        voidReason: number;
        wonMask: number;
        refundMask: number;
        lostMask: number;
        toPool: bigint;
        toHolders: bigint;
      }[]
    >`SELECT "seriesId", start, expiry, state, settled, calls, volume::int8 AS volume, "bandStake"::text[] AS "bandStake",
             "openedTx", "settledTx", "resolvedTx", "voidReason", "wonMask", "refundMask", "lostMask",
             "toPool"::int8 AS "toPool", "toHolders"::int8 AS "toHolders"
      FROM ${this.t("Window")} WHERE id = ${`${chainId}_${windowId.toLowerCase()}`}`;
    if (!w) return undefined;
    const series = seriesOf(chainId, w.seriesId as Hex);
    if (!series) return undefined;
    const prints = await this.db<{ t: number; priceE8: bigint; confE8: bigint; publishTime: number; txHash: string }[]>`
      SELECT t, "priceE8"::int8 AS "priceE8", "confE8"::int8 AS "confE8", "publishTime", "txHash" FROM ${this.t("Print")}
      WHERE "chainId" = ${chainId} AND "feedId" = ${feedIdOf(series.market)} AND t IN (${w.start}, ${w.expiry})`;
    const at = (t: number) => prints.find((p) => p.t === t) ?? null;
    // Calls still riding the window: settlement runs only while there are some (a window every call cashed out of
    // is never resolved on chain, and its proof says so rather than waiting for a close that won't be posted).
    const [live] = await this.db<{ n: number }[]>`
      SELECT count(*)::int AS n FROM ${this.t("Ticket")}
      WHERE "chainId" = ${chainId} AND "windowId" = ${windowId.toLowerCase()}
        AND status IN ('committed', 'open', 'closing')`;
    const rows = await this.db<TicketRow[]>`
      SELECT ${this.db.unsafe(TICKET_COLUMNS)}
      FROM ${this.t("Ticket")} t JOIN ${this.t("Window")} w ON w.id = t."chainId" || '_' || t."windowId"
      WHERE t."chainId" = ${chainId} AND t."windowId" = ${windowId.toLowerCase()}
      ORDER BY t."ticketId" LIMIT ${WINDOW_CALLS_MAX}`;
    const callList = rows.flatMap((r) => this.toCall(chainId, r));
    return { ...w, series, open: at(w.start), close: at(w.expiry), liveCalls: live?.n ?? 0, callList };
  }

  /** Recent windows anyone called in, newest first (the Proof feed), optionally one market's. */
  async windows(chainId: ChainId, symbol: string | undefined, before: number | undefined) {
    const series = symbol ? seriesIdsOf(chainId, symbol) : undefined;
    const rows = await this.db<
      {
        windowId: string;
        seriesId: string;
        start: number;
        expiry: number;
        state: string;
        openE8: bigint | null;
        closeE8: bigint | null;
        calls: number;
        volume: bigint;
      }[]
    >`SELECT "windowId", "seriesId", start, expiry, state, "openE8"::int8 AS "openE8", "closeE8"::int8 AS "closeE8",
             calls, volume::int8 AS volume
      FROM ${this.t("Window")}
      WHERE "chainId" = ${chainId} AND calls > 0
        ${before === undefined ? this.db`` : this.db`AND start < ${before}`}
        ${series ? this.db`AND "seriesId" IN ${this.db(series)}` : this.db``}
      ORDER BY start DESC LIMIT ${WINDOWS_PAGE}`;
    const windows = rows.flatMap((r) => {
      const s = seriesOf(chainId, r.seriesId as Hex);
      return s ? [{ ...r, symbol: s.market.symbol, cadenceSec: s.cadenceSec }] : [];
    });
    return { windows, next: rows.length === WINDOWS_PAGE ? (rows.at(-1)?.start ?? null) : null };
  }

  /** Practice and Real boards are separate (`chainId`); handles only for profiles listed on that network. */
  async leaderboard(chainId: ChainId, period: "day" | "week" | "all") {
    const listed = chainId === TESTNET_CHAIN_ID ? this.db`p.listed_practice` : this.db`p.listed_mainnet`;
    if (period === "all") {
      return this.db<{ owner: string; handle: string | null; pnl: bigint; calls: number; wins: number }[]>`
        SELECT a.owner, CASE WHEN ${listed} AND NOT p.hidden THEN p.handle END AS handle, a.pnl::int8 AS pnl, a.calls,
               a.wins
        FROM ${this.t("Account")} a LEFT JOIN profiles p ON p.address = a.owner
        WHERE a."chainId" = ${chainId} AND a.calls > 0 ORDER BY a.pnl DESC, a.calls DESC LIMIT ${LEADERBOARD_SIZE}`;
    }
    const days = period === "day" ? 1 : DAYS_PER_WEEK;
    const from = Math.floor(nowSec() / SECONDS_PER_DAY) - days + 1;
    return this.db<{ owner: string; handle: string | null; pnl: bigint; calls: number; wins: number }[]>`
      SELECT d.owner, CASE WHEN ${listed} AND NOT p.hidden THEN p.handle END AS handle, sum(d.pnl)::int8 AS pnl,
             sum(d.calls)::int AS calls, sum(d.wins)::int AS wins
      FROM ${this.t("DailyAccountStat")} d LEFT JOIN profiles p ON p.address = d.owner
      WHERE d."chainId" = ${chainId} AND d.day >= ${from}
      GROUP BY d.owner, p.handle, p.hidden, ${listed} ORDER BY sum(d.pnl) DESC LIMIT ${LEADERBOARD_SIZE}`;
  }

  async stats(chainId: ChainId, owner: string) {
    const [a] = await this.db<
      {
        calls: number;
        staked: bigint;
        returned: bigint;
        pnl: bigint;
        wins: number;
        losses: number;
        refunds: number;
        streak: number;
        bestStreak: number;
      }[]
    >`SELECT calls, staked::int8 AS staked, returned::int8 AS returned, pnl::int8 AS pnl, wins, losses, refunds, streak,
             "bestStreak"
      FROM ${this.t("Account")} WHERE id = ${`${chainId}_${owner.toLowerCase()}`}`;
    return a;
  }

  private toCall(chainId: ChainId, r: TicketRow) {
    const series = seriesOf(chainId, r.seriesId as Hex);
    if (!series) return [];
    const returned = r.proceeds + r.paid + r.refunded;
    return [
      {
        ticketId: r.ticketId,
        windowId: r.windowId as Hex,
        symbol: series.market.symbol,
        cadenceSec: series.cadenceSec,
        start: r.start,
        band: r.band,
        status: r.status as "settled",
        stake: r.originalStake,
        payout: r.payout,
        entryE8: r.entryE8,
        returned,
        pnl: FINISHED.has(r.status) ? (returned - r.originalStake).toString() : null,
        outcome: r.outcome as "win" | null,
        viaSession: r.viaSession,
        committedAt: r.committedAt,
        commitTx: r.committedTx as Hex,
        fillTx: r.fillTx as Hex | null,
        settleTx: r.claimTx as Hex | null,
      },
    ];
  }
}
