/**
 * The true outcome of one send. A live trace can lose a transaction after it was signed (`unknown`): the tx may still
 * land, so nothing may be re-sent or reported as unchanged. TxRecovery reconciles the journal in the background; once
 * the journal entry is terminal, that is the outcome (`settledOutcome` in `@senryo/query`). These hooks read the
 * journal for the ticket trace and the TP/SL legs (R01, R06).
 */
import type { JournalEntry } from "@senryo/chain";
import { settledOutcome, type TraceEvent, type TraceOutcome } from "@senryo/query";
import { useEffect, useState } from "react";
import { journalEntries } from "~/lib/account/sender";
import { JOURNAL_POLL_MS } from "./constants";

/**
 * The send journal, read on mount and whenever `tick` changes (a send started, advanced or ended), and polled while
 * `watch` is true (something is unresolved and TxRecovery is settling it behind the screen).
 */
export function useSendJournal(watch: boolean, tick: number): readonly JournalEntry[] {
  const [entries, setEntries] = useState<readonly JournalEntry[]>([]);
  // `tick` is a dependency on purpose: it re-reads the journal when a send starts, advances or ends.
  useEffect(() => {
    let stopped = false;
    const read = () =>
      void journalEntries().then((all) => {
        if (!stopped) setEntries(all);
      });
    read();
    const timer = watch ? setInterval(read, JOURNAL_POLL_MS) : undefined;
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
