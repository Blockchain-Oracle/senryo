"use client";
/**
 * Results land wherever you are in the app: the shared rules (`@senryo/calls` `useResults`, the phone's own) with the
 * web's effects — the win cue and haptic, the loss thud, confetti, and the result on its trade's toast (R5.11) with
 * the market's mark (R2.8) — and trades whose ending this device didn't see, re-read from its journal (R5.13).
 */
import { configureIntentJournal } from "@senryo/calls";
import { useIntentRecovery, useResults } from "@senryo/calls/react";
import { kvStore } from "@/lib/account/local";
import { useAccount } from "@/lib/account/provider";
import { fire } from "@/lib/feedback";
import { celebrate } from "@/lib/feedback/celebrate";
import { tradeToast } from "@/lib/trade-toast";

// The trades on their way live in the browser's store, so a reload re-reads them (R5.13).
configureIntentJournal({ get: kvStore.getItem, set: kvStore.setItem });

export function ResultHost() {
  const account = useAccount();
  useIntentRecovery(account.hint?.address, tradeToast);
  useResults(account, {
    cue: (c) =>
      c === "win"
        ? fire("win", { cue: "win" })
        : c === "loss"
          ? fire("loss", { cue: "loss" })
          : fire("confirm", { cue: "refund" }),
    celebrate,
    notify: ({ id, ...n }) => tradeToast(id, { ...n, tone: "info" }),
  });
  return null;
}
