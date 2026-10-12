/**
 * The Calls history, both apps (S5.11): every finished call (the indexer), newest first, each in the shared words,
 * grouped for the filters All · Won · Lost · Refunded (outcome words, never colour alone). What's open now is the live
 * book's (R5.3, `useLiveBook`), shown above it with its live value and Cash out.
 */
import type { Address } from "@senryo/account";
import { OPEN_STATES, signedUsd, stateWord, type Tone, toneOf } from "@senryo/core";
import { useCalls, useTickets } from "@senryo/query";

export const CALL_FILTERS = [
  { value: "all", label: "All" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "refunded", label: "Refunded" },
] as const;
export type CallFilter = (typeof CALL_FILTERS)[number]["value"];

export interface CallRow {
  key: string;
  ticketId: bigint;
  symbol: string;
  cadenceSec: number;
  band: number;
  stake: bigint;
  status: string;
  result: string;
  tone: Tone;
  group: Exclude<CallFilter, "all">;
}

export function useCallRows(owner: Address | undefined) {
  const tickets = useTickets(owner);
  const calls = useCalls(owner);
  // Open in the services' book (the indexer may still list it as open, or not have it yet): the live book shows it.
  const openIds = new Set(
    "value" in tickets ? tickets.value.tickets.filter((t) => OPEN_STATES.has(t.state)).map((t) => t.ticketId) : [],
  );
  const past: CallRow[] = (calls.data?.pages ?? [])
    .flatMap((p) => p.calls)
    .filter((c) => !OPEN_STATES.has(c.status) && !openIds.has(c.ticketId))
    .map((c) => {
      const pnl = c.pnl === null ? null : BigInt(c.pnl);
      const refunded = c.status === "refunded" || c.outcome === "refund";
      return {
        key: `call-${c.ticketId}`,
        ticketId: c.ticketId,
        symbol: c.symbol,
        cadenceSec: c.cadenceSec,
        band: c.band,
        stake: c.stake,
        status: stateWord(c),
        result: pnl === null ? "—" : signedUsd(pnl),
        tone: toneOf(pnl),
        group: refunded ? ("refunded" as const) : pnl !== null && pnl > 0n ? ("won" as const) : ("lost" as const),
      };
    });
  return {
    rows: past,
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
