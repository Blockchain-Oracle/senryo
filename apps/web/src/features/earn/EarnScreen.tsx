"use client";
/**
 * Earn as ownership (P5, D-325; the phone's Earn — Codex's ownership screen, Owarine's vault): the hero is what you
 * own — your share value, what you've earned and how much of the pool is yours — or, for a guest or before a first
 * supply, what one pool share is worth and what it did. A share's value over 1D / 7D / 30D (never deposits), the pool's
 * state (total, available, backing open calls against its cap, the next settlement), your pending requests as receipts
 * you can take back, the risk said plainly, and Supply / Withdraw opening the amount modal — never a bare input. One
 * passkey prompt each, relayed (`@senryo/calls` `useEarnFlow`).
 */
import type { EarnRange } from "@senryo/api-client";
import {
  EARN_NOT_OPEN,
  EARN_RISK,
  earnHeld,
  earnWords,
  netEarned,
  poolPanel,
  seriesReturn,
  sharePriceE12,
  sharePriceText,
  shareSeries,
  sharesFor,
} from "@senryo/calls";
import { useEarnFlow } from "@senryo/calls/react";
import { signedUsd, usd } from "@senryo/core";
import { dollarId } from "@senryo/identity";
import { useServerSeconds } from "@senryo/live/react";
import { earnKeys, useMarketAccount } from "@senryo/query";
import { useState } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ErrorPanel, useRetry } from "@/components/ui/reading";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useAccount } from "@/lib/account/provider";
import { fire } from "@/lib/feedback";
import { activeNetwork } from "@/lib/network";
import { notify } from "@/lib/notify";
import { DRAWERS, openDrawer } from "@/lib/shell/drawer-param";
import { cn } from "@/lib/utils";
import { EarnAmountModal, type EarnSide } from "./EarnAmountModal";
import { EarnChart } from "./EarnChart";

const HERO_MARK = 40;
const RANGES = [
  { value: "1d", label: "1D", hours: 24 },
  { value: "7d", label: "7D", hours: 168 },
  { value: "30d", label: "30D", hours: 720 },
] as const;
const BPS_PER_PERCENT = 100;
const BPS = 10_000n;
const PERCENT_DECIMALS = 2;
const NEAR_CAP = 0.8;
const TONE = { up: "text-up", down: "text-down", muted: "text-text-3" } as const;

export function EarnScreen() {
  const account = useAccount();
  const [range, setRange] = useState<EarnRange>("1d");
  const flow = useEarnFlow(account, range);
  const wallet = useMarketAccount(account.hint?.address);
  const balance = "value" in wallet ? wallet.value.balance : undefined;
  const now = useServerSeconds();
  const [modal, setModal] = useState<EarnSide | null>(null);
  const view = "value" in flow.view ? flow.view.value : undefined;
  const words = view ? earnWords(view, now) : null;
  const retry = useRetry(earnKeys.all);

  if (flow.view.status === "failed") return <ErrorPanel diagnosis={flow.view.error} retry={retry} />;
  if (!view) return <div aria-busy className="h-48 animate-pulse rounded-lg bg-skeleton" />;
  if (!words || !view.pool) {
    return (
      <div className="flex max-w-prose flex-col gap-1">
        <p className="font-semibold text-row-title">{EARN_NOT_OPEN.title}</p>
        <p className="text-body text-text-2">{EARN_NOT_OPEN.detail}</p>
      </div>
    );
  }
  const pool = view.pool;
  const signedIn = account.hint !== undefined;
  const held = earnHeld(view);
  const owns = held > 0n;
  const net = netEarned(view);
  const share = pool.value > 0n ? Number((held * BPS) / pool.value) / BPS_PER_PERCENT : 0;
  const series = shareSeries(view, now);
  const span = RANGES.find((r) => r.value === range) ?? RANGES[0];
  const ret = seriesReturn(series, span.hours);
  const panel = poolPanel(pool, now);
  const busy = flow.pending !== null;

  const confirm = async (side: EarnSide, amount: bigint, all: boolean) => {
    if (!signedIn) {
      openDrawer(DRAWERS.account);
      return;
    }
    fire("press");
    try {
      const r =
        side === "supply"
          ? await flow.supply(amount)
          : await flow.withdraw(all ? (view.account?.shares ?? 0n) : sharesFor(amount, pool));
      if (r.state === "sent") {
        fire("filled", { cue: "open" });
        notify({ title: side === "supply" ? "Supply requested" : "Withdrawal requested", description: words.next });
      }
    } catch (error) {
      fire("fail");
      notify({ title: "Didn't go through", description: (error as Error).message, tone: "warning" });
    }
  };
  const takeBack = (supply: boolean) => async () => {
    try {
      await flow.cancel(supply);
    } catch (error) {
      notify({ title: "Couldn't take it back", description: (error as Error).message, tone: "warning" });
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-8">
        <section aria-live="polite" className="flex flex-col gap-1">
          <span className="text-meta text-text-3">{owns ? "Your share value" : "Value of one pool share"}</span>
          <span className="flex items-center gap-3">
            <EntityMark id={dollarId(activeNetwork().chainId)} size={HERO_MARK} decorative />
            <span className="tnum font-display text-display-balance">
              {owns ? usd(held) : sharePriceText(sharePriceE12(pool))}
            </span>
          </span>
          {owns ? (
            <span className="text-body text-text-2">
              {net !== null ? (
                <span className={net > 0n ? "text-up" : net < 0n ? "text-down" : ""}>{signedUsd(net)} earned · </span>
              ) : null}
              {share.toFixed(PERCENT_DECIMALS)}% of the pool
            </span>
          ) : ret ? (
            <span className="text-body text-text-2">
              <span className={TONE[ret.tone]}>{ret.change}</span> · {ret.label}
            </span>
          ) : null}
        </section>
        <section aria-label="A share's value" className="flex flex-col gap-3">
          <SegmentedControl
            options={RANGES.map((r) => ({ value: r.value, label: r.label }))}
            label="Chart range"
            value={range}
            onValueChange={(v) => setRange(v as EarnRange)}
            className="self-start"
          />
          <EarnChart series={series} tone={ret?.tone ?? "muted"} longRange={range !== "1d"} />
          {owns && ret ? (
            <span className="text-meta text-text-3">
              A share <span className={TONE[ret.tone]}>{ret.change}</span> · {ret.label}
            </span>
          ) : null}
        </section>
        {words.supplying || words.withdrawing ? (
          <section aria-label="Your requests" className="flex flex-col gap-2">
            <h2 className="font-semibold text-section-title">Your requests</h2>
            {words.supplying ? (
              <Receipt
                text={words.supplying}
                busy={busy}
                {...(view.account?.supply.settled ? {} : { onTakeBack: takeBack(true) })}
              />
            ) : null}
            {words.withdrawing ? (
              <Receipt
                text={words.withdrawing}
                busy={busy}
                {...(view.account?.withdraw.settled ? {} : { onTakeBack: takeBack(false) })}
              />
            ) : null}
          </section>
        ) : null}
      </div>
      <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <section aria-label="The pool" className="flex flex-col gap-2 rounded-2xl bg-secondary p-4">
          <Row label="Pool value" value={panel.total} />
          <Row label="Available for withdrawals" value={panel.available} />
          <Row label="Backing open calls" value={panel.backing} />
          <ProgressBar
            label="In use for open calls"
            value={panel.usedBps}
            max={Math.max(panel.capBps, 1)}
            valueText={panel.usedText}
            tone={panel.usedBps > panel.capBps * NEAR_CAP ? "near" : "calm"}
          />
          <span className="tnum text-meta text-text-3">{panel.next}</span>
        </section>
        <p className="text-center text-meta text-text-3">{EARN_RISK}</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setModal("supply")}
            className="h-14 rounded-full bg-primary font-semibold text-button text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
          >
            Supply
          </button>
          <button
            type="button"
            disabled={busy || (signedIn && (view.account?.value ?? 0n) === 0n)}
            onClick={() => setModal("withdraw")}
            className="h-14 rounded-full bg-secondary font-semibold text-button focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
          >
            Withdraw
          </button>
        </div>
        <p className="text-meta text-text-3">{words.risk}</p>
      </aside>
      <EarnAmountModal
        side={modal}
        max={signedIn ? (modal === "withdraw" ? (view.account?.value ?? 0n) : balance) : undefined}
        pool={pool}
        next={words.next}
        signedIn={signedIn}
        onConfirm={(side, amount, all) => void confirm(side, amount, all)}
        onClose={() => setModal(null)}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3">
      <span className="text-body text-text-2">{label}</span>
      <span className="tnum font-semibold text-row-title">{value}</span>
    </div>
  );
}

function Receipt({ text, busy, onTakeBack }: { text: string; busy: boolean; onTakeBack?: () => void }) {
  return (
    <div className={cn("flex min-h-18 items-center justify-between gap-3 rounded-2xl bg-secondary px-4")}>
      <span className="text-body">{text}</span>
      {onTakeBack ? (
        <button
          type="button"
          disabled={busy}
          onClick={onTakeBack}
          className="rounded-full bg-(--shell-plate) px-4 py-2 font-semibold text-button-compact disabled:opacity-40"
        >
          Take back
        </button>
      ) : null}
    </div>
  );
}
