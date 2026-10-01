"use client";

import type { AccountSnapshot } from "@senryo/chain";
import type { Address } from "@senryo/core";
import { keys, useQueryEnv } from "@senryo/query";
import type { ReactNode } from "react";
import { EquityCurve } from "@/components/screens/portfolio/equity-curve";
import { PositionsTable, usePositionCount } from "@/components/screens/positions-table";
import { PerplBucket, Register } from "@/components/screens/register";
import { Direction, SectionLabel } from "@/components/shell/primitives";
import { known, ReadingView, useRetry } from "@/components/ui/reading";
import { Skeleton } from "@/components/ui/skeleton";
import { useBalance } from "@/lib/account/balance";
import { money, signedMoney, signedPct } from "@/lib/format";

/** Free to trade, Free to spend and Locked overlap (D-178): three cells, never an additive split. */
function Buckets({ snapshot, className }: { snapshot: AccountSnapshot; className?: string }) {
  return (
    <div className={className}>
      <Register snapshot={snapshot} className="mx-4" />
      <p className="mx-4 mt-2 text-caption text-muted-foreground">
        Three capacities, not a split: they overlap. Free to spend is what's free now, capped by today's card allowance.
      </p>
      <PerplBucket className="mx-4 mt-3 border-border border-t pt-2" />
    </div>
  );
}

function Empty() {
  return (
    <p className="mx-4 mt-2 text-caption text-muted-foreground">
      Nothing here yet · claim practice funds or deposit from any chain, then open your first position.
    </p>
  );
}

/**
 * One account's desk portfolio (D2 home): the risk-adjusted balance with its day change net of money moved in or out,
 * the indexed balance curve, the three capacities, and open positions — every figure from the chain or the indexer,
 * each section with its own loading, failed and stale state. `aside` adds right-column sections at ≥1024.
 */
export function AccountPortfolio({ address, aside }: { address: Address; aside?: ReactNode }) {
  const env = useQueryEnv();
  const { risk, change, changeBps } = useBalance(address);
  const retry = useRetry(keys.account(env.chainId, address));
  const count = usePositionCount(address);
  const snapshot = known(risk);
  const empty = snapshot !== undefined && snapshot.equityInit === 0n && snapshot.positionBitmap === 0;
  return (
    <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <section aria-labelledby="equity-label" className="min-w-0">
        <div className="px-4 pt-4">
          <p id="equity-label" className="font-mono text-label text-muted-foreground uppercase tracking-[0.2em]">
            Balance · risk-adjusted
          </p>
          <ReadingView
            reading={risk}
            loadingLabel="Reading your balance"
            retry={retry}
            className="mt-2"
            skeleton={<Skeleton className="h-10 w-56" />}
          >
            {(s) => (
              <>
                <p className="mt-1 font-mono font-semibold text-num-xl tabular-nums tracking-tight">
                  {money(s.equityInit)}
                </p>
                {change === undefined || changeBps === undefined ? (
                  <p className="font-mono text-caption text-muted-foreground">— 24h</p>
                ) : (
                  <Direction up={change >= 0n} className="text-caption">
                    {signedMoney(change)} ({signedPct(changeBps)}) 24h
                  </Direction>
                )}
              </>
            )}
          </ReadingView>
        </div>
        {empty ? (
          <Empty />
        ) : (
          <div className="mt-3 px-2">
            <EquityCurve address={address} />
          </div>
        )}
        {snapshot && !empty ? <Buckets snapshot={snapshot} className="mt-4 lg:hidden" /> : null}
        <SectionLabel className="lg:pt-8">Positions{count === undefined ? "" : ` · ${count}`}</SectionLabel>
        <PositionsTable address={address} className="mx-4" />
      </section>
      <aside aria-label="Buckets" className="hidden lg:block lg:pt-4">
        <SectionLabel>Buckets</SectionLabel>
        {snapshot ? (
          <Buckets snapshot={snapshot} />
        ) : risk.status === "unknown" ? (
          <Skeleton className="mx-4 h-16" />
        ) : (
          <p className="mx-4 text-caption text-warn">Unavailable until the balance reads · Retry beside it</p>
        )}
        {aside}
      </aside>
    </div>
  );
}
