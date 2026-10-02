"use client";

/**
 * A profile's period hero (flow book F2 step 4, C12; the phone's TraderStanding): the signed realized P&L for the
 * chosen period with the 24h · 7d · 30d · All chips, then one line — "Rank 12 · 34 trades", "Not ranked · 34 trades"
 * or "No trades · 7d", never a fake $0. The same snapshot as the leaderboard, so a profile and its board row agree.
 */
import type { LeaderboardPeriod } from "@senryo/api-client";
import { useQueryEnv, useStandings } from "@senryo/query";
import { useState } from "react";
import { AmountHero } from "@/components/kit/amount-hero";
import { known } from "@/components/ui/reading";
import { Skeleton } from "@/components/ui/skeleton";
import { signedMoneyOn } from "@/lib/format";
import { cn } from "@/lib/utils";

export const PERIODS: readonly { value: LeaderboardPeriod; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "all", label: "All" },
];
const PERIOD_SHORT: Record<LeaderboardPeriod, string> = { "24h": "24h", "7d": "7d", "30d": "30d", all: "all time" };

export function PeriodChips({
  value,
  onChange,
}: {
  value: LeaderboardPeriod;
  onChange: (p: LeaderboardPeriod) => void;
}) {
  return (
    <fieldset className="flex gap-1" aria-label="Period">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          type="button"
          aria-pressed={value === p.value}
          onClick={() => onChange(p.value)}
          className={cn(
            "h-8 rounded-full px-3 text-meta",
            value === p.value ? "bg-foreground text-background" : "bg-raised-2 text-text-2 hover:text-foreground",
          )}
        >
          {p.label}
        </button>
      ))}
    </fieldset>
  );
}

export function Standing({ address }: { address: string }) {
  const env = useQueryEnv();
  const [period, setPeriod] = useState<LeaderboardPeriod>("7d");
  const reading = useStandings([address], period);
  const standing = known(reading)?.items[0];
  const pnl = standing?.netPnlUsd6 ?? null;
  const trades = standing?.trades ?? null;
  const tradesWord = trades === null ? "" : ` · ${trades} ${trades === 1 ? "trade" : "trades"}`;
  return (
    <section className="grid gap-2" aria-label="Realized result">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {reading.status === "unknown" ? (
          <Skeleton className="h-12 w-40" />
        ) : standing && pnl !== null ? (
          <AmountHero text={signedMoneyOn(env.chainId, pnl)} tone={pnl < 0n ? "down" : "up"} />
        ) : (
          <p className="text-sheet-title text-text-3">—</p>
        )}
        <PeriodChips value={period} onChange={setPeriod} />
      </div>
      <p className="text-meta text-text-3">
        {reading.status === "failed"
          ? "Result unavailable"
          : standing
            ? standing.status === "ranked" && standing.rank !== null
              ? `Rank ${standing.rank}${tradesWord}`
              : trades
                ? `Not ranked${tradesWord}`
                : `No trades · ${PERIOD_SHORT[period]}`
            : null}
      </p>
    </section>
  );
}
