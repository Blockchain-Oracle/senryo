import { configureIntentJournal } from "@senryo/calls";
import { useGuestSweep, useIntentRecovery, useResults } from "@senryo/calls/react";
import { celebrate } from "~/feedback/celebrate";
import { fire } from "~/feedback/fire";
import { useAppTrader } from "~/lib/account/guest";
import { useAccount } from "~/lib/account/provider";
import { notify } from "~/lib/notify";
import { storage } from "~/lib/storage";
import { tradeToast } from "~/lib/trade-toast";

// The trades on their way live in MMKV, so a kill or an update re-reads them on the next launch (R5.13).
configureIntentJournal({ get: (k) => storage.getString(k), set: (k, v) => storage.set(k, v) });

/**
 * Results land wherever you are: the shared rules (`@senryo/calls` `useResults`) with the phone's effects — the win
 * cue and haptic, the soft thud for a loss, confetti, and the result on its trade's toast (R5.11) with the market's
 * mark (R2.8) — trades whose ending this device didn't see, re-read from its journal (R5.13), and a former
 * guest's test dollars moving to the account it made (R5.10).
 */
export function ResultHost() {
  const trader = useAppTrader();
  useIntentRecovery(trader.owner, tradeToast);
  // A guest who made a passkey: its test dollars follow it to the account (R5.10).
  useGuestSweep(useAccount().hint?.address, notify);
  useResults(trader.caller, {
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
