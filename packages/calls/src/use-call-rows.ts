/**
 * The trades history, both apps (S5.11; rides joined 13 Oct — they had been missing since R4): every finished call
 * and every finished ride (the indexer), newest first, each in the shared words, grouped for the filters All · Won ·
 * Lost · Refunded (outcome words, never colour alone). A ride's result is its net after fees, as its receipt says
 * (D-327). What's open now is the live book's (R5.3, `useLiveBook`), shown above it with its live value.
 */
import type { Address } from "@senryo/account";
import type { RideView } from "@senryo/api-client";
import { lane, OPEN_STATES, sideName, signedUsd, stateWord, type Tone, toneOf } from "@senryo/core";
import { useCalls, useRides, useTickets } from "@senryo/query";
import { useMemo } from "react";
import { leverageText } from "./book-words.ts";
import { rideNet } from "./trade-slip.ts";

export const CALL_FILTERS = [
  { value: "all", label: "All" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "refunded", label: "Refunded" },
] as const;
export type CallFilter = (typeof CALL_FILTERS)[number]["value"];

export interface CallRow {
  key: string;
  kind: "call" | "ride";
  /** The call's ticket or the ride's id: its receipt. */
  id: bigint;
  symbol: string;
  /** "BTC Up", "BTC Up · Ride". */
  title: string;
  /** What went in: a call's stake, a ride's opening margin. */
  stake: bigint;
  /** "1m" for a call, "10×" for a ride. */
  tag: string;
  status: string;
  result: string;
  tone: Tone;
  group: Exclude<CallFilter, "all">;
  /** When it ended or was made (unix s), for the order. */
  at: number;
}

const FINISHED_RIDE = new Set<RideView["state"]>(["closed", "knocked_out", "capped", "ended", "refunded"]);
const RIDE_WORD: Record<string, string> = {
  closed: "Closed",
  knocked_out: "Knocked out",
  capped: "Capped",
  ended: "Ended",
  refunded: "Refunded",
};
const MS = 1_000;

function rideRow(r: RideView): CallRow {
  const net = r.state === "refunded" ? 0n : rideNet(r);
  return {
    key: `ride-${r.rideId}`,
    kind: "ride",
    id: r.rideId,
    symbol: r.symbol,
    title: `${r.symbol} ${r.isLong ? "Up" : "Down"} · Ride`,
    stake: r.marginOpen ?? r.margin,
    tag: leverageText(r.leverageBps),
    status: RIDE_WORD[r.state] ?? r.state,
    result: signedUsd(net),
    tone: toneOf(net),
    group: r.state === "refunded" ? "refunded" : net > 0n ? "won" : "lost",
    at: Math.floor(Date.parse(r.updatedAt) / MS),
  };
}

export function useCallRows(owner: Address | undefined) {
  const tickets = useTickets(owner);
  const calls = useCalls(owner);
  const rides = useRides(owner);
  const rideList = "value" in rides ? rides.value.rides : undefined;
  const callPages = calls.data?.pages;
  const ticketList = "value" in tickets ? tickets.value.tickets : undefined;
  const rows = useMemo(() => {
    // Open in the services' book (the indexer may still list it as open, or not have it yet): the live book shows it.
    const openIds = new Set((ticketList ?? []).filter((t) => OPEN_STATES.has(t.state)).map((t) => t.ticketId));
    const past: CallRow[] = (callPages ?? [])
      .flatMap((p) => p.calls)
      .filter((c) => !OPEN_STATES.has(c.status) && !openIds.has(c.ticketId))
      .map((c) => {
        const pnl = c.pnl === null ? null : BigInt(c.pnl);
        const refunded = c.status === "refunded" || c.outcome === "refund";
        return {
          key: `call-${c.ticketId}`,
          kind: "call" as const,
          id: c.ticketId,
          symbol: c.symbol,
          title: `${c.symbol} ${sideName(c.band)}`,
          stake: c.stake,
          tag: lane(c.cadenceSec),
          status: stateWord(c),
          result: pnl === null ? "—" : signedUsd(pnl),
          tone: toneOf(pnl),
          group: refunded ? ("refunded" as const) : pnl !== null && pnl > 0n ? ("won" as const) : ("lost" as const),
          at: c.start,
        };
      });
    const ended = (rideList ?? []).filter((r) => FINISHED_RIDE.has(r.state)).map(rideRow);
    return [...past, ...ended].sort((a, b) => b.at - a.at);
  }, [callPages, ticketList, rideList]);
  return {
    rows,
    pending: calls.isPending,
    failed: calls.isError && !calls.data,
    hasMore: calls.hasNextPage,
    loadingMore: calls.isFetchingNextPage,
    loadMore: () => {
      if (!calls.isFetchingNextPage) void calls.fetchNextPage();
    },
  };
}

export const filterRows = (rows: readonly CallRow[], filter: CallFilter): CallRow[] =>
  filter === "all" ? [...rows] : rows.filter((r) => r.group === filter);
