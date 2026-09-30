"use client";

import { useRouter } from "next/navigation";
import { PositionsTable } from "@/components/screens/positions-table";
import { PerplBucket, Register } from "@/components/screens/register";
import { Ticket } from "@/components/screens/trade/ticket";
import { SectionLabel } from "@/components/shell/primitives";
import { CandleChart } from "@/components/ui/candle";
import { MarketWatchlist } from "@/components/ui/market-watchlist";
import { ROUTES } from "@/lib/constants/routes";
import { age, amount, pctBps, plotValue, usdCompact } from "@/lib/format";
import { changePct, toWatchlist } from "@/lib/market-view";
import { MARKETS, POSITIONS, type SampleMarket } from "@/lib/sample";
import { sampleCandles } from "@/lib/sample-series";
import { cn } from "@/lib/utils";

const WATCHLIST = MARKETS.map(toWatchlist);

function MarketHeader({ market }: { market: SampleMarket }) {
  const up = market.changeBps >= 0n;
  const open = market.session === "OPEN" || market.session === "24/7";
  return (
    <div className="flex items-end justify-between gap-3 px-4 pt-3">
      <div className="min-w-0">
        <h1 className="font-bold font-mono text-num-md">
          {market.symbol}-PERP{" "}
          <span className="font-normal text-label text-muted-foreground uppercase">{market.name} / USD</span>
        </h1>
        <p className="font-mono font-semibold text-num-ticker tabular-nums">
          {amount(market.price6)}{" "}
          <span className={cn("text-caption", up ? "text-up" : "text-down")}>
            <span aria-hidden>{up ? "▲" : "▼"}</span> {pctBps(market.changeBps)}
          </span>
        </p>
      </div>
      <dl className="shrink-0 text-right font-mono text-micro text-muted-foreground leading-4">
        <div>
          <dt className="inline">FUND </dt>
          <dd className="inline text-foreground">{pctBps(market.fundingBps)}</dd>
        </div>
        <div>
          <dt className="inline">OI </dt>
          <dd className="inline text-foreground">{usdCompact(market.oi6)}</dd>
        </div>
        <div>
          <dt className="inline">SESSION </dt>
          <dd className={cn("inline", open ? "text-primary" : "text-gold")}>{market.session}</dd>
        </div>
        <div>
          <dt className="inline">ORACLE </dt>
          <dd className="inline text-foreground">{age(market.oracleAgeSec)}</dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * Trade (D2 ticket). Phone: header → candles → ticket → trace, 1:1 with the D2 preview.
 * ≥1024: the 3-column desk — watchlist · candles + positions · register + ticket + trace.
 */
export function TradeScreen({ market }: { market: SampleMarket }) {
  const router = useRouter();
  const candles = sampleCandles(plotValue(market.price6), market.seed);
  return (
    <div className="lg:grid lg:grid-cols-[20rem_minmax(0,1fr)_24rem] lg:gap-x-4 lg:pt-3">
      <aside aria-label="Watchlist" className="hidden lg:block">
        <MarketWatchlist
          title="Perps · 24h"
          initial={market.symbol}
          assets={WATCHLIST}
          onSelect={(symbol) => router.push(ROUTES.trade(symbol))}
        />
      </aside>
      <section aria-label={`${market.symbol} chart`} className="min-w-0">
        <MarketHeader market={market} />
        <div className="mt-2 border-border border-y lg:border">
          <CandleChart
            candles={candles}
            symbol={market.symbol}
            exchange={market.venue}
            chrome={false}
            fill
            plotClassName="h-72 lg:h-112"
            key={market.symbol}
          />
        </div>
        <p className="sr-only">
          {market.symbol} change {changePct(market)} percent over the window.
        </p>
        <div className="hidden lg:block">
          <SectionLabel>Positions · {POSITIONS.length}</SectionLabel>
          <PositionsTable className="mx-4" />
        </div>
      </section>
      <aside aria-label="Order ticket" className="min-w-0 lg:border lg:border-border lg:pb-4">
        <div className="hidden lg:block">
          <SectionLabel className="pt-3">Buckets</SectionLabel>
          <Register className="mx-4" />
          <PerplBucket className="mx-4 mt-2 mb-3" />
        </div>
        <Ticket market={market} className="lg:border-border lg:border-t" />
      </aside>
    </div>
  );
}
