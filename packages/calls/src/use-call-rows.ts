/**
 * The Calls list, both apps (S5.11): what's open now (the services' ticket book, live) then every call before it (the
 * indexer), newest first, each in the shared words, grouped for the filters All · Open · Won · Lost · Refunded
 * (outcome words, never colour alone).
 */
import type { Address } from "@senryo/account";
import { OPEN_STATES, signedUsd, stateWord, type Tone, toneOf, usd } from "@senryo/core";
import { useCalls, useTickets } from "@senryo/query";

export const CALL_FILTERS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
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
  const open: CallRow[] =
    "value" in tickets
      ? tickets.value.tickets
          .filter((t) => OPEN_STATES.has(t.state))
          .map((t) => ({
            key: `open-${t.ticketId}`,
            ticketId: t.ticketId,
            symbol: t.symbol,
            cadenceSec: t.cadenceSec,
            band: t.band,
            stake: t.stake,
            status: stateWord({ status: t.state, outcome: null }),
            result: t.state === "committed" ? "…" : `pays ${usd(t.payout)}`,
            tone: "muted" as const,
            group: "open" as const,
          }))
      : [];
  const openIds = new Set(open.map((r) => r.ticketId));
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
    rows: [...open, ...past],
    open,
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
