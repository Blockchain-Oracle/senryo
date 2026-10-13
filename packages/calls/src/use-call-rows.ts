/**
 * Your history, both apps (S5.11; rides joined 13 Oct; D1 the same evening — "anything I did should show in my
 * history"): every finished call and ride (the indexer), event call, parlay and duel, newest first, each in the shared
 * words, grouped for the filters All · Won · Lost · Refunded (outcome words, never colour alone). A ride's result is
 * its net after fees, as its receipt says (D-327); a duel is one row for its pot and cards (`history-rows.ts`); Lucky's
 * calls say so. What's open now is the live book's (R5.3, `useLiveBook`), shown above it with its live value.
 */
import type { Address } from "@senryo/account";
import type { RideView } from "@senryo/api-client";
import { lane, OPEN_STATES, sideName, signedUsd, stateWord, toneOf } from "@senryo/core";
import { useCalls, useDuels, useEventCalls, useLuckyDraws, useParlays, useRides, useTickets } from "@senryo/query";
import { useMemo } from "react";
import { leverageText } from "./book-words.ts";
import { duelRow, eventRow, type HistoryRow, isDuelCard, parlayRow } from "./history-rows.ts";
import { rideNet } from "./trade-slip.ts";

export const CALL_FILTERS = [
  { value: "all", label: "All" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "refunded", label: "Refunded" },
] as const;
export type CallFilter = (typeof CALL_FILTERS)[number]["value"];

/**
 * One history row: a call, a ride, an event call, a parlay or a duel. `title` reads "BTC Up", "BTC Up · Ride", the
 * event's question, "Parlay · BTC + ETH" or "Duel"; `stake` is what went in; `tag` the lane, leverage, side or legs;
 * `open` where a tap goes and `mark` what it shows. `at` (unix s) orders the list.
 */
export interface CallRow extends HistoryRow {
  kind: "call" | "ride" | "event" | "parlay" | "duel";
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
    open: { kind: "ride", id: r.rideId },
    mark: { kind: "market", symbol: r.symbol },
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
  const events = useEventCalls(owner);
  const parlays = useParlays(owner);
  const duels = useDuels(owner);
  const draws = useLuckyDraws(owner);
  const rideList = "value" in rides ? rides.value.rides : undefined;
  const eventList = "value" in events ? events.value : undefined;
  const parlayList = "value" in parlays ? parlays.value.parlays : undefined;
  const duelList = "value" in duels ? duels.value.duels : undefined;
  const drawList = "value" in draws ? draws.value : undefined;
  const callPages = calls.data?.pages;
  const ticketList = "value" in tickets ? tickets.value.tickets : undefined;
  const rows = useMemo(() => {
    // Open in the services' book (the indexer may still list it as open, or not have it yet): the live book shows it.
    const openIds = new Set((ticketList ?? []).filter((t) => OPEN_STATES.has(t.state)).map((t) => t.ticketId));
    // Lucky's draws name the calls they placed: those rows say Lucky.
    const lucky = new Set((drawList ?? []).flatMap((d) => (d.ticketId === null ? [] : [d.ticketId])));
    const past: CallRow[] = (callPages ?? [])
      .flatMap((p) => p.calls)
      .filter((c) => !OPEN_STATES.has(c.status) && !openIds.has(c.ticketId) && !isDuelCard(c))
      .map((c) => {
        const pnl = c.pnl === null ? null : BigInt(c.pnl);
        const refunded = c.status === "refunded" || c.outcome === "refund";
        return {
          key: `call-${c.ticketId}`,
          kind: "call" as const,
          open: { kind: "call" as const, id: c.ticketId },
          mark: { kind: "market" as const, symbol: c.symbol },
          title: `${c.symbol} ${sideName(c.band)}`,
          stake: c.stake,
          tag: lucky.has(c.ticketId) ? `Lucky · ${lane(c.cadenceSec)}` : lane(c.cadenceSec),
          status: stateWord(c),
          result: pnl === null ? "—" : signedUsd(pnl),
          tone: toneOf(pnl),
          group: refunded ? ("refunded" as const) : pnl !== null && pnl > 0n ? ("won" as const) : ("lost" as const),
          at: c.start,
        };
      });
    const ended = (rideList ?? []).filter((r) => FINISHED_RIDE.has(r.state)).map(rideRow);
    const others: CallRow[] = [
      ...(eventList ?? []).flatMap((c) => withKind(eventRow(c), "event")),
      ...(parlayList ?? []).flatMap((p) => withKind(parlayRow(p), "parlay")),
      ...(duelList ?? []).flatMap((m) => withKind(duelRow(m, owner), "duel")),
    ];
    return [...past, ...ended, ...others].sort((a, b) => b.at - a.at);
  }, [callPages, ticketList, rideList, eventList, parlayList, duelList, drawList, owner]);
  return {
    rows,
    pending: calls.isPending,
    failed: calls.isError && !calls.data,
    hasMore: calls.hasNextPage,
    loadingMore: calls.isFetchingNextPage,
    loadMore: () => {
      if (!calls.isFetchingNextPage) void calls.fetchNextPage();
    },
    /** Ask for the history again (a failed load's Try again, both apps). */
    retry: () => void calls.refetch(),
  };
}

const withKind = (row: HistoryRow | null, kind: CallRow["kind"]): CallRow[] => (row ? [{ ...row, kind }] : []);

export const filterRows = (rows: readonly CallRow[], filter: CallFilter): CallRow[] =>
  filter === "all" ? [...rows] : rows.filter((r) => r.group === filter);
