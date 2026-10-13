"use client";
/**
 * Your record (R5.20; Owarine's account stats, laid out as 21st Stats Band's plain grid — numbers on the page, no boxes):
 * lifetime PnL, win rate, trades, win streak, best streak and volume over everything traded on this network. The
 * indexer's account counts calls, rides, parlays and event calls in the order they ended (`statsView`). Money hides with
 * privacy; counts don't.
 */
import { statsView } from "@senryo/calls";
import { signedUsd, toneOf, usd } from "@senryo/core";
import { useCallerStats } from "@senryo/query";
import { masked } from "@/lib/shell/privacy";
import { cn } from "@/lib/utils";

const TONE = { up: "text-up", down: "text-down", muted: "" } as const;

export function StatsCard({ owner, hidden }: { owner: `0x${string}`; hidden: boolean }) {
  const stats = useCallerStats(owner);
  if (!("value" in stats) || stats.value.calls === 0) return null;
  const v = statsView(stats.value);
  const cells = [
    { label: "Lifetime PnL", value: masked(signedUsd(v.pnl), hidden), tone: TONE[toneOf(v.pnl)] },
    { label: "Win rate", value: v.winRate },
    { label: "Trades", value: String(v.trades) },
    { label: "Win streak", value: String(v.streak) },
    { label: "Best streak", value: String(v.bestStreak) },
    { label: "Volume", value: masked(usd(v.volume), hidden) },
  ];
  return (
    <section aria-label="Your record">
      <dl className="grid grid-cols-3 gap-x-4 gap-y-4">
        {cells.map((c) => (
          <div key={c.label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-meta text-text-3">{c.label}</dt>
            <dd className={cn("tnum truncate font-semibold text-num-md", c.tone)}>{c.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
