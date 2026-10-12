import { configureIntentJournal } from "@senryo/calls";
import { useIntentRecovery, useResults } from "@senryo/calls/react";
import { celebrate } from "~/feedback/celebrate";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { storage } from "~/lib/storage";
import { tradeToast } from "~/lib/trade-toast";

// The trades on their way live in MMKV, so a kill or an update re-reads them on the next launch (R5.13).
configureIntentJournal({ get: (k) => storage.getString(k), set: (k, v) => storage.set(k, v) });

/**
 * Results land wherever you are: the shared rules (`@senryo/calls` `useResults`) with the phone's effects — the win
 * cue and haptic, the soft thud for a loss, confetti, and the result on its trade's toast (R5.11) with the market's
 * mark (R2.8) — and trades whose ending this device didn't see, re-read from its journal (R5.13).
 */
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
