"use client";
/**
 * Parlay (S8.5, D-293; the web's `/app/parlay/`, the phone's Parlay screen): pick 2–4 calls on the windows trading now,
 * the slip prices them as the chain will (the odds multiply, legs in one asset class count as moving together), one
 * tap or one passkey places it gas-free, and your parlays follow each leg to its result.
 */
import { useParlayFlow, useParlayQuote } from "@senryo/calls/react";
import { useCatalog } from "@senryo/query";
import { useState } from "react";
import { useAccount } from "@/lib/account/provider";
import { fire } from "@/lib/feedback";
import { notify } from "@/lib/notify";
import { DRAWERS, openDrawer } from "@/lib/shell/drawer-param";
import { ParlayList } from "./ParlayList";
import { ParlayPicker } from "./ParlayPicker";
import { ParlaySlip } from "./ParlaySlip";

const DEFAULT_STAKE = 5_000_000n;

export function ParlayScreen() {
  const account = useAccount();
  const catalog = useCatalog();
  const [stake, setStake] = useState(DEFAULT_STAKE);
  const flow = useParlayFlow(account, {
    cue: (c) => (c === "filled" ? fire("filled", { cue: "open" }) : fire(c)),
    notify: (n) => notify({ ...n, tone: "warning" }),
    needAccount: () =>
      notify({
        title: "Sign in to place a parlay",
        description: "Your passkey is your account.",
        action: { label: "Sign in", onClick: () => openDrawer(DRAWERS.account) },
      }),
  });
  const quote = useParlayQuote(flow.picks, stake);
  const halfSpreadE6 = "value" in catalog ? catalog.value.terms.halfSpreadE6 : 0;
  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <ParlayPicker picks={flow.picks} onPick={flow.pick} />
        <div className="lg:sticky lg:top-6 lg:self-start">
          <ParlaySlip
            quote={quote}
            halfSpreadE6={halfSpreadE6}
            stake={stake}
            onStake={setStake}
            onPick={flow.pick}
            onRemove={flow.remove}
            onPlace={() => void flow.place(quote, stake)}
            pending={flow.pending}
            balance={flow.balance}
          />
        </div>
      </div>
      <ParlayList owner={account.hint?.address} />
    </div>
  );
}
