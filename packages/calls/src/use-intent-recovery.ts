/**
 * Trades whose ending this device didn't see (R5.13): the journal's entries from before this launch, and this run's
 * sends whose answer was lost. Each is read by digest — unknown → checking → filled or refused — and said on its own
 * toast: "Up BTC 1m opened · it went through while the app was closed", "didn't go through", "never reached us".
 * A read that fails leaves it unknown with Check status, which reads again and never sends. This run's other trades
 * are followed quietly (their flows and results speak) and leave the journal once they settle.
 */
import { useIntentStatuses, useQueryEnv, useRefreshCaller } from "@senryo/query";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import {
  forgetIntent,
  intentsOf,
  type JournalEntry,
  journalVersion,
  subscribeJournal,
  wasLost,
} from "./intent-journal.ts";
import { reasonWords } from "./reason-words.ts";
import type { TradeNote } from "./toast-run.ts";

const LAUNCHED_AT = Date.now();
const SETTLED = new Set(["filled", "refused", "failed"]);

type Read = ReturnType<typeof useIntentStatuses>[number];

const doneWord = (e: JournalEntry) =>
  e.kind === "open" ? "opened" : e.instrument === "call" ? "cashed out" : "closed";
const keptWords = (e: JournalEntry) => (e.kind === "open" ? "Nothing was taken." : "It's still open.");
const whyUnseen = (e: JournalEntry) =>
  wasLost(e.digest) ? "Only the answer was lost on the way." : "It was on its way when the app closed.";

/** What the toast says for this read, and a key for that step (a step is said once). */
function stepOf(e: JournalEntry, r: Read): { step: string; note: Omit<TradeNote, "symbol"> } {
  const state = r.status?.state;
  if (state === "filled")
    return { step: "filled", note: { title: `${e.what} ${doneWord(e)}`, description: whyUnseen(e), tone: "info" } };
  if (state && SETTLED.has(state))
    return {
      step: "refused",
      note: {
        title: `${e.what} didn't go through`,
        description: reasonWords(r.status?.reason, keptWords(e)),
        tone: "warning",
      },
    };
  if (r.notFound)
    return {
      step: "missing",
      note: { title: `${e.what} never reached us`, description: keptWords(e), tone: "warning" },
    };
  if (r.failed && !r.checking)
    return {
      step: "unknown",
      note: {
        title: `Couldn't check ${e.what}`,
        description: "It may have gone through. Checking only reads; it never sends twice.",
        tone: "warning",
        action: { label: "Check status", run: r.refetch },
      },
    };
  return { step: "checking", note: { title: `Checking ${e.what}…`, description: whyUnseen(e), tone: "loading" } };
}

export function useIntentRecovery(owner: `0x${string}` | undefined, toast: (id: string, note: TradeNote) => void) {
  const env = useQueryEnv();
  const refresh = useRefreshCaller(owner);
  const version = useSyncExternalStore(subscribeJournal, journalVersion, journalVersion);
  // The journal's version re-reads it on every write.
  const entries = useMemo(() => (owner ? intentsOf(env.chainId, owner) : []), [owner, env.chainId, version]);
  const reads = useIntentStatuses(entries.map((e) => e.digest));
  const said = useRef(new Map<string, string>());
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    reads.forEach((r, i) => {
      const e = entries[i];
      if (!e) return;
      const { step, note } = stepOf(e, r);
      const ended = step === "filled" || step === "refused" || step === "missing";
      if (ended) {
        forgetIntent(e.digest);
        if (step === "filled") refresh();
      }
      if (!(e.sentAt < LAUNCHED_AT || wasLost(e.digest)) || said.current.get(e.digest) === step) return;
      said.current.set(e.digest, step);
      toastRef.current(e.toast, { ...note, symbol: e.symbol });
    });
  }, [reads, entries, refresh]);
}
