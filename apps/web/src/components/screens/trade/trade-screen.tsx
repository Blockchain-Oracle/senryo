"use client";

/**
 * Market detail + ticket (flow book C2, C3). Phone widths: the header (mark, ticker, leverage badge, venue + mode), the
 * price with its 24 h change, the chart, your position in this market when there is one, About, then the ticket.
 * ≥1024: the ticket sits in the right column beside the chart, always in view. A market not listed on this network
 * says so instead of drawing a page for it.
 */
import { type EngineMarket, engineMarket, engineMarketsOn } from "@senryo/config";
import { useAccountRisk, usePositions } from "@senryo/query";
import { PositionRow } from "@/components/home/position-row";
import { PageHeader } from "@/components/kit/page-header";
import { MarketChart } from "@/components/screens/trade/market-chart";
import { MarketHeader } from "@/components/screens/trade/market-header";
import { MarketAbout } from "@/components/trade/market-about";
import { Ticket } from "@/components/trade/ticket";
import { known, ReadingView, useRetry } from "@/components/ui/reading";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccount } from "@/lib/account/provider";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { ROUTES } from "@/lib/constants/routes";
import { useMarketLine } from "@/lib/markets/line";

function HeldPosition({ marketId }: { marketId: number }) {
  const address = useAccount().hint?.address;
  const held = known(usePositions(address))?.find((p) => p.marketId === marketId);
  const account = known(useAccountRisk(address, "latest"));
  if (!held) return null;
  return (
    <section aria-label="Your position" className="grid gap-1">
      <h2 className="text-section-title">Your position</h2>
      <PositionRow position={held} account={account} />
    </section>
  );
}

function MarketDetail({ meta }: { meta: EngineMarket }) {
  const reading = useMarketLine(meta.id, meta.symbol);
  const retry = useRetry(["market", ACTIVE_NETWORK.chainId]);
  const line = known(reading);
  return (
    <>
      <PageHeader back={ROUTES.markets} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        <section aria-label={`${meta.name} chart`} className="grid min-w-0 gap-6">
          <MarketHeader meta={meta} reading={reading} />
          <ReadingView reading={reading} loadingLabel={`Reading ${meta.name}`} retry={retry}>
            {(l) => <MarketChart line={l} />}
          </ReadingView>
          <HeldPosition marketId={meta.id} />
          {line ? <MarketAbout line={line} /> : null}
        </section>
        <aside aria-label="Order ticket" className="min-w-0 lg:sticky lg:top-20">
          {line ? (
            <Ticket market={line.market} />
          ) : reading.status === "failed" ? (
            <p className="text-meta text-text-2">The ticket opens once {meta.name}’s price reads.</p>
          ) : (
            <Skeleton className="h-96 w-full" />
          )}
        </aside>
      </div>
    </>
  );
}

export function TradeScreen({ marketId }: { marketId: number }) {
  const meta = engineMarket(marketId);
  const listed = meta !== undefined && engineMarketsOn(ACTIVE_NETWORK.chainId).some((m) => m.id === meta.id);
  if (meta && listed) return <MarketDetail meta={meta} />;
  return (
    <p className="mt-6 text-row text-text-2">
      {meta ? `${meta.name} isn’t listed in ${ACTIVE_NETWORK.modeLabel} yet.` : "This market isn’t tradeable here yet."}
    </p>
  );
}
