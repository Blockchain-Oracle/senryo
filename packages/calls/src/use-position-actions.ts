/**
 * Close any position the live book holds (R5.3): a call in any market or lane at its exact cash-out (the bid the
 * book shows, less the call tolerance), or a ride at the mark within the slippage limit. Close all closes each
 * closable one in turn — one prompt each without one-tap, none with it. Each close is journalled under its position's
 * toast (R5.11, R5.13), where its result lands.
 */
import { useLive } from "@senryo/live/react";
import { useCallback, useState } from "react";
import type { BookEntry } from "./book.ts";
import type { Caller } from "./caller.ts";
import type { JournalMark } from "./intent-journal.ts";
import { tradeToastId } from "./toast-run.ts";
import { type CallResult, useCallActions } from "./use-call.ts";
import { type RideResult, useRideActions } from "./use-ride.ts";
import { windowOfCall } from "./window.ts";

export type CloseResult = CallResult | RideResult;

const SECONDS_PER_MINUTE = 60;

/** A position's close as the journal names it, under the toast its result lands on. */
export function closeMark(e: BookEntry): JournalMark {
  return e.kind === "call"
    ? {
        what: `Your ${e.symbol} ${(e.call?.cadenceSec ?? 0) / SECONDS_PER_MINUTE}m call`,
        kind: "close",
        instrument: "call",
        symbol: e.symbol,
        toast: tradeToastId.call(e.id),
      }
    : {
        what: `${e.up ? "Up" : "Down"} ${e.symbol} ride`,
        kind: "close",
        instrument: "ride",
        symbol: e.symbol,
        toast: tradeToastId.ride(e.id),
      };
}

export function usePositionActions(caller: Caller) {
  const calls = useCallActions(caller);
  const rides = useRideActions(caller);
  const live = useLive();
  const [closing, setClosing] = useState<ReadonlySet<string>>(new Set());

  const mark = (key: string, on: boolean) =>
    setClosing((was) => {
      const next = new Set(was);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const close = useCallback(
    async (e: BookEntry): Promise<CloseResult | null> => {
      if (e.closeValue === null) return null;
      mark(e.key, true);
      try {
        if (e.kind === "call" && e.call) {
          return await calls.close({
            window: windowOfCall(e.symbol, e.call.cadenceSec, e.call.start, live.clock.nowSec()),
            ticketId: e.id,
            band: e.call.band,
            shares: e.call.shares,
            proceedsQuote: e.closeValue,
            journal: closeMark(e),
          });
        }
        if (e.kind === "ride" && e.markE8 !== null && e.up !== null) {
          return await rides.close({
            rideId: e.id,
            symbol: e.symbol,
            isLong: e.up,
            markE8: e.markE8,
            journal: closeMark(e),
          });
        }
        return null;
      } finally {
        mark(e.key, false);
      }
    },
    [calls, rides, live],
  );

  const closeAll = useCallback(
    async (entries: readonly BookEntry[]): Promise<CloseResult[]> => {
      const out: CloseResult[] = [];
      for (const e of entries) {
        const r = await close(e);
        if (!r) continue;
        out.push(r);
        // A cancelled prompt stops the run: the rider said no.
        if (r.kind === "cancelled") break;
      }
      return out;
    },
    [close],
  );

  return { ready: calls.ready, close, closeAll, closing };
}
