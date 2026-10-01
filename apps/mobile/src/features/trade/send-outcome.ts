/**
 * The true outcome of one send. A live trace can lose a transaction after it was signed (`unknown`): the tx may still
 * land, so nothing may be re-sent or reported as unchanged. TxRecovery reconciles the journal in the background; once
 * the journal entry is terminal, that is the outcome. Shared by the ticket trace and the TP/SL legs (R01, R06).
 */
import type { JournalEntry } from "@senryo/chain";
import { isTerminalStage, type TxStage } from "@senryo/core";
import { type TraceEvent, type TraceOutcome, traceOutcome } from "@senryo/query";
import { useEffect, useState } from "react";
import { journalEntries } from "~/lib/account/sender";
import { JOURNAL_POLL_MS } from "./constants";

const FROM_STAGE: Partial<Record<TxStage, TraceOutcome>> = {
  finalized: "finalized",
  reverted: "reverted",
  abandoned: "abandoned",
};

/** The hash a trace signed, if it got that far. */
export function signedHash(events: readonly TraceEvent[]): `0x${string}` | undefined {
  return events.find((e) => e.hash !== undefined)?.hash;
}

/** The trace's own outcome, with `unknown` replaced by the journal's once TxRecovery has settled that tx. */
export function settledOutcome(
  events: readonly TraceEvent[],
  journal: readonly JournalEntry[],
): TraceOutcome | undefined {
  const outcome = traceOutcome(events);
  if (outcome !== "unknown") return outcome;
  const hash = signedHash(events);
  const entry = journal.find((j) => j.hash === hash);
  return (entry && isTerminalStage(entry.stage) ? FROM_STAGE[entry.stage] : undefined) ?? "unknown";
}

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
