"use client";
/**
 * Earn (S7.6, D-287; the phone's `EarnScreen`): your share of the pool that takes the other side, what the pool holds
 * and how much of it is ready, when the next hour settles, what you've asked for (take it back until then), and Supply
 * / Withdraw by an exact amount — one passkey prompt each, relayed (`@senryo/calls` `useEarnFlow`). Risk in words.
 */
import { earnWords, hourLines, sharesFor } from "@senryo/calls";
import { checkEarnAmount, useEarnFlow } from "@senryo/calls/react";
import { useServerSeconds } from "@senryo/live/react";
import { earnKeys, useMarketAccount } from "@senryo/query";
import { useState } from "react";
import { ErrorPanel, useRetry } from "@/components/ui/reading";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useAccount } from "@/lib/account/provider";
import { fire } from "@/lib/feedback";
import { notify } from "@/lib/notify";
import { DRAWERS, openDrawer } from "@/lib/shell/drawer-param";
import { cn } from "@/lib/utils";

const SIDES = [
  { value: "supply", label: "Supply" },
  { value: "withdraw", label: "Withdraw" },
] as const;
type Side = (typeof SIDES)[number]["value"];
/** Dollars are 6-decimal on both networks. */
const USD_UNIT = 1_000_000;
const CENTS = 2;

function Pending({ text, onCancel, busy }: { text: string; onCancel?: () => void; busy: boolean }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3">
      <span className="text-body text-text-2">{text}</span>
      {onCancel ? (
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-full bg-secondary px-4 py-2 font-semibold text-button-compact disabled:opacity-40"
        >
          Take back
        </button>
      ) : null}
    </div>
  );
}

export function EarnScreen() {
  const account = useAccount();
  const flow = useEarnFlow(account);
  const wallet = useMarketAccount(account.hint?.address);
  const balance = "value" in wallet ? wallet.value.balance : undefined;
  const now = useServerSeconds();
  const [side, setSide] = useState<Side>("supply");
  const [amount, setAmount] = useState("");
  const view = "value" in flow.view ? flow.view.value : undefined;
  const words = view ? earnWords(view, now) : null;
  const retry = useRetry(earnKeys.all);

  if (flow.view.status === "failed") return <ErrorPanel diagnosis={flow.view.error} retry={retry} />;
  if (!view) return <div aria-busy className="h-48 animate-pulse rounded-lg bg-skeleton" />;
  if (!words || !view.pool) return <p className="text-body text-text-2">Earn isn't open yet.</p>;
  const pool = view.pool;
  const max = side === "supply" ? balance : view.account?.value;
  const check = checkEarnAmount(
    amount,
    max,
    side === "supply"
      ? "Reading your balance…"
      : view.account
        ? "Reading your position…"
        : "Nothing supplied to withdraw",
  );
  const busy = flow.pending !== null;

  const submit = async () => {
    if (!account.hint) {
      openDrawer(DRAWERS.account);
      return;
    }
    if (!check.ok || check.value === undefined) return;
    fire("press");
    try {
      const all = side === "withdraw" && check.value === view.account?.value;
      const r =
        side === "supply"
          ? await flow.supply(check.value)
          : await flow.withdraw(all ? (view.account?.shares ?? 0n) : sharesFor(check.value, pool));
      if (r.state === "sent") {
        fire("filled", { cue: "open" });
        setAmount("");
        notify({ title: side === "supply" ? "Supply requested" : "Withdrawal requested", description: words.next });
      }
    } catch (error) {
      fire("fail");
      notify({ title: "Didn't go through", description: (error as Error).message, tone: "warning" });
    }
  };

  const cancel = (supply: boolean) => async () => {
    try {
      await flow.cancel(supply);
    } catch (error) {
      notify({ title: "Couldn't take it back", description: (error as Error).message, tone: "warning" });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Your share" className="flex flex-col gap-1">
        <span className="tnum font-semibold text-hero">{words.hero}</span>
        <span className="text-body text-text-2">{words.heroDetail}</span>
      </section>

      <section aria-label="The pool" className="flex flex-col gap-1">
        <span className="font-semibold text-row-title">{words.pool}</span>
        <span className="text-meta text-text-3">{words.ready}</span>
        <span className="tnum text-meta text-text-3">{words.next}</span>
      </section>

      {view.hours.length > 1 ? (
        <section aria-label="Hour by hour" className="flex flex-col gap-1">
          <h2 className="font-semibold text-section-title">Hour by hour</h2>
          <ul className="flex flex-col">
            {hourLines(view).map((h) => (
              <li key={h.key} className="flex min-h-10 items-center justify-between gap-3">
                <span className="tnum text-meta text-text-3">{h.time}</span>
                <span
                  className={cn(
                    "tnum text-meta",
                    h.tone === "up" ? "text-up" : h.tone === "down" ? "text-down" : "text-text-2",
                  )}
                >
                  {h.change}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {words.supplying || words.withdrawing ? (
        <section aria-label="Your requests" className="flex flex-col">
          {words.supplying ? (
            <Pending
              text={words.supplying}
              busy={busy}
              {...(view.account?.supply.settled ? {} : { onCancel: cancel(true) })}
            />
          ) : null}
          {words.withdrawing ? (
            <Pending
              text={words.withdrawing}
              busy={busy}
              {...(view.account?.withdraw.settled ? {} : { onCancel: cancel(false) })}
            />
          ) : null}
        </section>
      ) : null}

      <section aria-label="Supply or withdraw" className="flex flex-col gap-3">
        <SegmentedControl
          options={SIDES}
          label="Supply or withdraw"
          value={side}
          onValueChange={(v) => {
            setSide(v as Side);
            setAmount("");
          }}
          className="self-start"
        />
        <label className="flex h-14 items-center gap-2 rounded-full bg-secondary px-5">
          <span className="font-semibold text-row-title text-text-3">$</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            aria-label={side === "supply" ? "Dollars to supply" : "Dollars to withdraw"}
            className="tnum h-full w-full min-w-0 bg-transparent font-semibold text-row-title outline-none placeholder:text-text-3"
          />
          {max !== undefined && max > 0n ? (
            <button
              type="button"
              onClick={() => setAmount((Number(max) / USD_UNIT).toFixed(CENTS))}
              className="rounded-full px-3 py-1 font-semibold text-button-compact text-link"
            >
              {side === "supply" ? "Max" : "All"}
            </button>
          ) : null}
        </label>
        {check.problem ? <p className="text-meta text-destructive">{check.problem}</p> : null}
        {!check.problem && check.hint && account.hint ? <p className="text-meta text-text-3">{check.hint}</p> : null}
        <button
          type="button"
          disabled={busy || (Boolean(account.hint) && !check.ok)}
          onClick={() => void submit()}
          className={cn(
            "h-14 rounded-full font-semibold text-button",
            side === "supply" ? "bg-primary text-primary-foreground" : "bg-foreground text-background",
            "disabled:opacity-40",
          )}
        >
          {!account.hint
            ? "Sign in to earn"
            : busy
              ? "Waiting for your passkey…"
              : side === "supply"
                ? "Supply at the next hour"
                : "Withdraw at the next hour"}
        </button>
      </section>

      <p className="text-meta text-text-3">{words.risk}</p>
    </div>
  );
}
