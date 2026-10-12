"use client";
/**
 * Closing a position from any list on the web (R5.3): the press, the shared close (`usePositionActions`), and a
 * plain warning when it doesn't go through. What it returned arrives as the result toast (`ResultHost`).
 */
import { type BookEntry, closeWord, reasonWords } from "@senryo/calls";
import { usePositionActions } from "@senryo/calls/react";
import { useAccount } from "@/lib/account/provider";
import { fire } from "@/lib/feedback";
import { notify } from "@/lib/notify";

export function usePositionClose() {
  const actions = usePositionActions(useAccount());
  const fail = (e: BookEntry | null, error: unknown) => {
    fire("fail", { cue: "error" });
    notify({
      title: e ? `Couldn't ${closeWord(e).toLowerCase()}` : "Couldn't close everything",
      description: reasonWords((error as Error).message, e?.kind === "ride" ? "It's still open." : "Nothing changed."),
      tone: "warning",
    });
  };
  const close = async (e: BookEntry) => {
    fire("press");
    try {
      await actions.close(e);
    } catch (error) {
      fail(e, error);
    }
  };
  const closeAll = async (entries: readonly BookEntry[]) => {
    fire("press");
    try {
      await actions.closeAll(entries.filter((e) => e.closeValue !== null));
    } catch (error) {
      fail(null, error);
    }
  };
  return { close, closeAll, closing: actions.closing, ready: actions.ready };
}
