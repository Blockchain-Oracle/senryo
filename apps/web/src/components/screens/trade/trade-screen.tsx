"use client";

import { type EngineMarket, engineMarket, engineMarketsOn } from "@senryo/config";
import type { Address } from "@senryo/core";
import { useAccountRisk } from "@senryo/query";
import { DeskWatchlist } from "@/components/screens/markets/desk-watchlist";
import { PositionsTable, usePositionCount } from "@/components/screens/positions-table";
import { PerplBucket, Register } from "@/components/screens/register";
import { MarketChart } from "@/components/screens/trade/market-chart";
import { MarketHeader } from "@/components/screens/trade/market-header";
import { Ticket } from "@/components/screens/trade/ticket";
import { SectionLabel } from "@/components/shell/primitives";
import { known, ReadingView, useRetry } from "@/components/ui/reading";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccount } from "@/lib/account/provider";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { type MarketLines, useMarketLine, useMarketLines } from "@/lib/markets/line";

/** Buckets over the ticket for a signed-in account; a guest sees none (the ticket says how to start). */
function AccountBuckets({ address }: { address: Address }) {
  const snapshot = known(useAccountRisk(address, "finalized"));
  return (
    <>
      <SectionLabel className="pt-3">Buckets</SectionLabel>
      {snapshot ? <Register snapshot={snapshot} className="mx-4" /> : <Skeleton className="mx-4 h-14" />}
      <PerplBucket className="mx-4 mt-2 mb-3" />
    </>
  );
}

function AccountPositions({ address }: { address: Address }) {
  const count = usePositionCount(address);
  return (
    <>
      <SectionLabel>Positions{count === undefined ? "" : ` · ${count}`}</SectionLabel>
      <PositionsTable address={address} className="mx-4 lg:mx-0" />
    </>
  );
}

function MarketDesk({ meta, lines }: { meta: EngineMarket; lines: MarketLines }) {
  const address = useAccount().hint?.address;
  const reading = useMarketLine(meta.id, meta.symbol);
  const retry = useRetry(["market", ACTIVE_NETWORK.chainId]);
  // The live market; one value across the page, so a tick re-renders the header and the ticket together.
  const line = known(reading);
  return (
    <div className="lg:grid lg:grid-cols-[22rem_minmax(0,1fr)_24rem] lg:gap-x-4 lg:pt-3">
      <aside aria-label="Watchlist" className="hidden lg:block">
        <DeskWatchlist lines={lines} selected={meta.symbol} compact />
      </aside>
      <section aria-label={`${meta.name} chart`} className="min-w-0">
        <MarketHeader meta={meta} reading={reading} />
        <div className="mt-3">
          <ReadingView reading={reading} loadingLabel={`Reading ${meta.name}`} retry={retry} className="mx-4 lg:mx-0">
            {(line) => <MarketChart line={line} />}
          </ReadingView>
        </div>
        {address ? (
          <div className="hidden lg:block">
            <AccountPositions address={address} />
          </div>
        ) : null}
      </section>
      <aside aria-label="Order ticket" className="min-w-0 lg:border lg:border-border lg:pb-4">
        {address ? (
          <div className="hidden lg:block">
            <AccountBuckets address={address} />
          </div>
        ) : null}
        {line ? (
          <Ticket market={line.market} className="lg:border-border lg:border-t" />
        ) : reading.status === "failed" ? (
          <p className="m-4 text-caption text-muted-foreground">The ticket opens once {meta.name}'s price reads.</p>
        ) : (
          <Skeleton className="m-4 h-64" />
        )}
      </aside>
    </div>
  );
}

/**
 * Trade (S11b). Phone: header → candles → ticket. ≥1024: the 3-column desk — watchlist · header, candles and the
 * account's positions · buckets and the ticket. Every market figure is the engine's live reading; a market that isn't
 * listed on this network says so instead of drawing a page for it.
 */
export function TradeScreen({ marketId }: { marketId: number }) {
  const meta = engineMarket(marketId);
  const lines = useMarketLines();
  const listed = meta !== undefined && engineMarketsOn(ACTIVE_NETWORK.chainId).some((m) => m.id === meta.id);
  if (meta && listed) return <MarketDesk meta={meta} lines={lines} />;
  return (
    <p className="mx-4 mt-6 text-body text-muted-foreground">
      {meta ? `${meta.name} isn't listed in ${ACTIVE_NETWORK.modeLabel} yet.` : "This market isn't tradeable here yet."}
    </p>
  );
}
