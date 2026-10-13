import { LOOKUP_HITS_MAX, type LookupHit, type LookupKind } from "@senryo/api-client";
import { type Hex, seriesOf } from "@senryo/chain";
import { type ChainId, RIDE_MARKETS } from "@senryo/config";
import type { Db } from "@senryo/service-common";

/**
 * A pasted id (R6.6) over the indexer's tables: a hash is matched against every transaction column we keep (each
 * call's and ride's events, a parlay's, a duel's, an event call's and a window's) and against the 32-byte ids (a
 * window, an event, a duel match); a number against each kind's own id. Rare (a paste) and the tables small, so the
 * hash columns go unindexed; every query filters on `chainId` (D-173).
 */
const HASH = /^0x[0-9a-f]{64}$/;
const NUMBER = /^\d{1,20}$/;

interface Row {
  kind: LookupKind;
  id: string;
  series: string | null;
  market: number | null;
  at: number | null;
  ref: string | null;
}

export class IndexerLookup {
  constructor(
    private readonly db: Db,
    private readonly schema: string,
  ) {}

  private t(name: string) {
    return this.db`${this.db(this.schema)}.${this.db(name)}`;
  }

  async find(chainId: ChainId, query: string): Promise<LookupHit[]> {
    const q = query.trim().toLowerCase();
    const rows = HASH.test(q) ? await this.byHash(chainId, q) : NUMBER.test(q) ? await this.byNumber(chainId, q) : [];
    const seen = new Set<string>();
    return rows
      .filter((r) => {
        const key = `${r.kind}:${r.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, LOOKUP_HITS_MAX)
      .map((r) => ({
        kind: r.kind,
        id: r.id,
        symbol: r.series
          ? (seriesOf(chainId, r.series as Hex)?.market.symbol ?? null)
          : r.market !== null
            ? (RIDE_MARKETS[r.market] ?? null)
            : null,
        at: r.at,
        ref: r.ref,
      }));
  }

  private byHash(chainId: ChainId, h: string) {
    const c = chainId;
    return this.db<Row[]>`
      SELECT 'call' AS kind, t."ticketId"::text AS id, w."seriesId" AS series, NULL::int AS market,
             t."committedAt" AS at, NULL AS ref
        FROM ${this.t("Ticket")} t JOIN ${this.t("Window")} w ON w.id = t."chainId" || '_' || t."windowId"
        WHERE t."chainId" = ${c} AND (lower(t."committedTx") = ${h} OR lower(t."fillTx") = ${h}
          OR lower(t."claimTx") = ${h} OR t."ticketId" IN (
            SELECT "ticketId" FROM ${this.t("TicketEvent")} WHERE "chainId" = ${c} AND lower("txHash") = ${h}))
      UNION ALL
      SELECT 'ride', "rideId"::text, NULL, "marketId", "committedAt", NULL
        FROM ${this.t("Ride")}
        WHERE "chainId" = ${c} AND (lower("committedTx") = ${h} OR lower("fillTx") = ${h} OR "rideId" IN (
          SELECT "rideId" FROM ${this.t("RideEvent")} WHERE "chainId" = ${c} AND lower("txHash") = ${h}))
      UNION ALL
      SELECT 'parlay', "parlayId"::text, NULL, NULL, "committedAt", NULL
        FROM ${this.t("Parlay")}
        WHERE "chainId" = ${c} AND (lower("committedTx") = ${h} OR lower("settleTx") = ${h})
      UNION ALL
      SELECT 'duel', "matchId", NULL, NULL, "openedAt", NULL
        FROM ${this.t("Duel")}
        WHERE "chainId" = ${c} AND (lower("matchId") = ${h} OR lower("openTx") = ${h} OR lower("revealTx") = ${h}
          OR lower("finishTx") = ${h})
      UNION ALL
      SELECT 'event', "eventId", NULL, NULL, "calledAt", "ticketId"::text
        FROM ${this.t("EventCall")}
        WHERE "chainId" = ${c} AND (lower("callTx") = ${h} OR lower("paidTx") = ${h})
      UNION ALL
      SELECT 'event', "eventId", NULL, NULL, "listedAt", NULL
        FROM ${this.t("EventMarket")}
        WHERE "chainId" = ${c} AND (lower("eventId") = ${h} OR lower("listedTx") = ${h} OR lower("decidedTx") = ${h})
      UNION ALL
      SELECT 'window', "windowId", "seriesId", NULL, start, NULL
        FROM ${this.t("Window")}
        WHERE "chainId" = ${c} AND (lower("windowId") = ${h} OR lower("openedTx") = ${h}
          OR lower("resolvedTx") = ${h} OR lower("settledTx") = ${h})
      LIMIT ${LOOKUP_HITS_MAX * 2}`;
  }

  private byNumber(chainId: ChainId, n: string) {
    const c = chainId;
    return this.db<Row[]>`
      SELECT 'call' AS kind, t."ticketId"::text AS id, w."seriesId" AS series, NULL::int AS market,
             t."committedAt" AS at, NULL AS ref
        FROM ${this.t("Ticket")} t JOIN ${this.t("Window")} w ON w.id = t."chainId" || '_' || t."windowId"
        WHERE t."chainId" = ${c} AND t."ticketId" = ${n}::numeric
      UNION ALL
      SELECT 'ride', "rideId"::text, NULL, "marketId", "committedAt", NULL
        FROM ${this.t("Ride")} WHERE "chainId" = ${c} AND "rideId" = ${n}::numeric
      UNION ALL
      SELECT 'parlay', "parlayId"::text, NULL, NULL, "committedAt", NULL
        FROM ${this.t("Parlay")} WHERE "chainId" = ${c} AND "parlayId" = ${n}::numeric
      UNION ALL
      SELECT 'event', "eventId", NULL, NULL, "calledAt", "ticketId"::text
        FROM ${this.t("EventCall")} WHERE "chainId" = ${c} AND "ticketId" = ${n}::numeric`;
  }
}
