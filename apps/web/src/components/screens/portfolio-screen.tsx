"use client";

import { BucketBar } from "@/components/screens/bucket-bar";
import { CardAuths } from "@/components/screens/card-auths";
import { PositionsTable } from "@/components/screens/positions-table";
import { PerplBucket, Register } from "@/components/screens/register";
import { Direction, SectionLabel } from "@/components/shell/primitives";
import { BalanceChart } from "@/components/ui/balance-chart";
import { pctBps, plotValue, usd } from "@/lib/format";
import { BALANCE, POSITIONS } from "@/lib/sample";
import { sampleEquityFrames } from "@/lib/sample-series";

const FRAMES = sampleEquityFrames(plotValue(BALANCE.total6));

/** Portfolio (D2 home): equity hero + chart, three-cell register, partition bar, positions. */
export function PortfolioScreen() {
  const up = BALANCE.pnl24h6 >= 0n;
  return (
    <div className="grid gap-x-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <section aria-labelledby="equity-label">
        <div className="px-4 pt-4">
          <p id="equity-label" className="font-mono text-label text-muted-foreground uppercase tracking-[0.2em]">
            Equity · risk-adjusted
          </p>
          <p className="mt-1 font-mono font-semibold text-num-xl tabular-nums tracking-tight">{usd(BALANCE.total6)}</p>
          <Direction up={up} className="text-caption">
            {usd(BALANCE.pnl24h6)} ({pctBps(BALANCE.pnl24hBps)}) 24h
          </Direction>
        </div>
        <div className="mt-3 px-2">
          <BalanceChart frames={FRAMES} initialFrame="24H" />
        </div>
        <SectionLabel className="lg:pt-8">Positions · {POSITIONS.length}</SectionLabel>
        <PositionsTable className="mx-4" />
      </section>
      <aside aria-label="Buckets" className="lg:pt-4">
        <SectionLabel className="hidden lg:flex">Buckets</SectionLabel>
        <Register className="mx-4 mt-2 lg:mt-0" />
        <BucketBar className="mx-4 mt-3" />
        <PerplBucket className="mx-4 mt-3 border-border border-t pt-2" />
        <div className="hidden lg:block">
          <SectionLabel>Card · authorizations</SectionLabel>
          <CardAuths className="mx-4" />
        </div>
      </aside>
    </div>
  );
}
