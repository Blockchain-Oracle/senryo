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

function Buckets({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Register className="mx-4" />
      <BucketBar className="mx-4 mt-3" />
      <PerplBucket className="mx-4 mt-3 border-border border-t pt-2" />
    </div>
  );
}

/**
 * Portfolio (D2 home). Phone: equity hero → chart → register → bar → positions (the D2 order).
 * ≥1024: chart + positions on the left; buckets and card holds in the right column.
 */
export function PortfolioScreen() {
  const up = BALANCE.pnl24h6 >= 0n;
  return (
    <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <section aria-labelledby="equity-label" className="min-w-0">
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
        <Buckets className="mt-2 lg:hidden" />
        <SectionLabel className="lg:pt-8">Positions · {POSITIONS.length}</SectionLabel>
        <PositionsTable className="mx-4" />
      </section>
      <aside aria-label="Buckets" className="hidden lg:block lg:pt-4">
        <SectionLabel>Buckets</SectionLabel>
        <Buckets />
        <SectionLabel>Card · authorizations</SectionLabel>
        <CardAuths className="mx-4" />
      </aside>
    </div>
  );
}
