"use client";

/**
 * The true outcome of one send (as on the phone): a live trace can lose a transaction after it was signed (`unknown`)
 * — it may still land, so nothing may be re-sent or reported as unchanged. Recovery reconciles the journal in the
 * background; once the entry is terminal, that is the outcome (`settledOutcome`).
 */
import type { JournalEntry } from "@senryo/chain";
import { settledOutcome, type TraceEvent, type TraceOutcome } from "@senryo/query";
import { useEffect, useState } from "react";
import { journalEntries, recoverJournal } from "@/lib/account/sender";
import { JOURNAL_POLL_MS } from "@/lib/constants/ticket";

/** The send journal, read on mount and whenever `tick` changes, and polled (with a recovery pass) while `watch`. */
function useSendJournal(watch: boolean, tick: number): readonly JournalEntry[] {
  const [entries, setEntries] = useState<readonly JournalEntry[]>([]);
  // `tick` re-reads the journal when a send starts, advances or ends.
  useEffect(() => {
    let stopped = false;
    const read = () =>
      void journalEntries().then((all) => {
        if (!stopped) setEntries(all);
      });
    read();
    const timer = watch
      ? setInterval(
          () =>
            void recoverJournal()
              .catch(() => undefined)
              .then(read),
          JOURNAL_POLL_MS,
        )
      : undefined;
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [watch, tick]);
  return entries;
}

/** One trace's settled outcome, polling the journal only while it is unknown. */
export function useSettledOutcome(events: readonly TraceEvent[]): TraceOutcome | undefined {
  const [watch, setWatch] = useState(false);
  const journal = useSendJournal(watch, events.length);
  const outcome = settledOutcome(events, journal);
  useEffect(() => setWatch(outcome === "unknown"), [outcome]);
  return outcome;
}
