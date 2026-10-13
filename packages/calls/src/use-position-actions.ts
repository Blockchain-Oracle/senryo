/**
 * Close any position the live book holds (R5.3): a call in any market or lane at its exact cash-out (the bid the
 * book shows, less the call tolerance), or a ride at the mark within the slippage limit. Close all closes each
 * closable one in turn — one prompt each without one-tap, none with it. Each close is journalled under its position's
 * toast (R5.11, R5.13), where its result lands.
 *
 * A close answers at once and only once (D3, the owner's iPhone review): a second tap on the same position does
 * nothing while the first is on its way; the tap puts "Closing…" / "Cashing out…" on the position's toast before the
 * signature; and the position stays closing until the relay's answer settles — a refusal said on that toast, as the
 * terminal's own Cash out does (`settleRun`) — instead of springing back to "Close $x" the moment the relay replied.
 */
import { useLive } from "@senryo/live/react";
import { useIntentStatuses } from "@senryo/query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BookEntry } from "./book.ts";
import type { Caller } from "./caller.ts";
import type { JournalMark } from "./intent-journal.ts";
import { reasonWords } from "./reason-words.ts";
import { type TradeNote, tradeToastId } from "./toast-run.ts";
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

/** What a close does around itself in the app: the position's one toast, and the fail cue for a refusal. */
export interface PositionCloseEffects {
  toast(id: string, note: TradeNote | null): void;
  fail?(): void;
}

const SETTLED = new Set(["filled", "refused", "failed"]);

/** A close on its way: the relay took it; the row stays closing until its status settles. */
interface InFlight {
  key: string;
  digest: `0x${string}`;
  toast: string;
  symbol: string;
  ride: boolean;
}

export function usePositionActions(caller: Caller, fx?: PositionCloseEffects) {
  const calls = useCallActions(caller);
  const rides = useRideActions(caller);
  const live = useLive();
  const [closing, setClosing] = useState<ReadonlySet<string>>(new Set());
  // The synchronous guard: a tap in the same frame as another sees it before any state has rendered.
  const inflight = useRef(new Set<string>());
  const [watching, setWatching] = useState<readonly InFlight[]>([]);
  const fxRef = useRef(fx);
  fxRef.current = fx;
  // Close all's run, one at a time: which one it's on, of how many ("Closing 1 of 2…").
  const [batch, setBatch] = useState<{ at: number; of: number } | null>(null);

  const mark = (key: string, on: boolean) =>
    setClosing((was) => {
      const next = new Set(was);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const release = (key: string) => {
    inflight.current.delete(key);
    mark(key, false);
  };

  // A close the relay took settles here: filled hands over to the result (it lands on the same toast via `useResults`),
  // refused or failed is said on that toast; either way the position is no longer held as closing.
  const statuses = useIntentStatuses(watching.map((w) => w.digest));
  useEffect(() => {
    for (const s of statuses) {
      const w = watching.find((x) => x.digest === s.digest);
      if (!w || !s.status || !SETTLED.has(s.status.state)) continue;
      if (s.status.state !== "filled") {
        fxRef.current?.fail?.();
        fxRef.current?.toast(w.toast, {
          title: w.ride ? "Close didn't go through" : "Cash-out didn't go through",
          description: reasonWords(s.status.reason, "It's still open."),
          symbol: w.symbol,
          tone: "warning",
        });
      }
      release(w.key);
      setWatching((was) => was.filter((x) => x.digest !== w.digest));
    }
  }, [statuses, watching]);

  // The send itself, on this render's actions (the memoised `close` reads it through the ref).
  const send = async (e: BookEntry): Promise<CloseResult | null> => {
    if (e.kind === "call" && e.call && e.closeValue !== null) {
      return calls.close({
        window: windowOfCall(e.symbol, e.call.cadenceSec, e.call.start, live.clock.nowSec()),
        ticketId: e.id,
        band: e.call.band,
        shares: e.call.shares,
        proceedsQuote: e.closeValue,
        journal: closeMark(e),
      });
    }
    if (e.kind === "ride" && e.markE8 !== null && e.up !== null) {
      return rides.close({ rideId: e.id, symbol: e.symbol, isLong: e.up, markE8: e.markE8, journal: closeMark(e) });
    }
    return null;
  };
  const sendRef = useRef(send);
  sendRef.current = send;

  const close = useCallback(async (e: BookEntry): Promise<CloseResult | null> => {
    if (e.closeValue === null || inflight.current.has(e.key)) return null;
    inflight.current.add(e.key);
    mark(e.key, true);
    const id = closeMark(e).toast;
    const ride = e.kind === "ride";
    fxRef.current?.toast(id, { title: ride ? "Closing…" : "Cashing out…", symbol: e.symbol, tone: "loading" });
    let held = false;
    try {
      const r = await sendRef.current(e);
      if (r?.kind === "sent") {
        held = true;
        setWatching((was) => [...was, { key: e.key, digest: r.status.digest, toast: id, symbol: e.symbol, ride }]);
      } else if (r?.kind === "cancelled" || r === null) fxRef.current?.toast(id, null);
      return r;
    } catch (error) {
      fxRef.current?.toast(id, null);
      throw error;
    } finally {
      if (!held) release(e.key);
    }
  }, []);

  const closeAll = useCallback(
    async (entries: readonly BookEntry[]): Promise<CloseResult[]> => {
      const out: CloseResult[] = [];
      try {
        for (const [i, e] of entries.entries()) {
          setBatch({ at: i + 1, of: entries.length });
          const r = await close(e);
          if (!r) continue;
          out.push(r);
          // A cancelled prompt stops the run: the rider said no.
          if (r.kind === "cancelled") break;
        }
      } finally {
        setBatch(null);
      }
      return out;
    },
    [close],
  );

  return { ready: calls.ready, close, closeAll, closing, batch };
}
