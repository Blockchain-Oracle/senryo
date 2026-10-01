"use client";

import { useRouter } from "next/navigation";
import { ArrivingMarketRow, EngineMarketRow, marketTitles } from "@/components/screens/markets/market-row";
import { MarketWatchlist } from "@/components/ui/market-watchlist";
import { known, useRetry } from "@/components/ui/reading";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { BPS_PERCENT_DECIMALS } from "@/lib/constants/money";
import { ROUTES } from "@/lib/constants/routes";
import { plotValue } from "@/lib/format";
import type { MarketLines } from "@/lib/markets/line";
import { useNowSec } from "@/lib/markets/session";
import { arrivingMarkets, inFilter, type MarketFilter } from "@/lib/markets/universe";

/**
 * The desk watchlist (Markets and the trade page's left column): our engine's markets on this network from their live
 * readings, then — when `arriving` — the markets that don't trade here yet with the reason, never a price.
 */
export function DeskWatchlist({
  lines,
  filter = "all",
  selected,
  arriving = false,
  compact = false,
  title = "Perps · 24h",
  className,
}: {
  lines: MarketLines;
  filter?: MarketFilter;
  selected?: string | undefined;
  arriving?: boolean;
  /** The trade page's narrow column: no sparkline. */
  compact?: boolean;
  title?: string;
  className?: string;
}) {
  const router = useRouter();
  const now = useNowSec();
  const retry = useRetry(["market", ACTIVE_NETWORK.chainId]);
  const rows = lines
    .filter((l) => inFilter(l.meta, filter))
    .map((l) => {
      const change = known(l.reading)?.change24hBps;
      return {
        key: l.meta.symbol,
        name: marketTitles(l.meta).title,
        change: change === undefined ? undefined : plotValue(change, BPS_PERCENT_DECIMALS),
        line: l,
      };
    });
  const later = arriving ? arrivingMarkets(ACTIVE_NETWORK.chainId, filter) : [];
  return (
    <MarketWatchlist
      title={title}
      rows={rows}
      selected={selected}
      className={className}
      compact={compact}
      renderRow={(row, isSelected) => (
        <EngineMarketRow
          meta={row.line.meta}
          reading={row.line.reading}
          selected={isSelected}
          now={now}
          retry={retry}
          compact={compact}
          onOpen={(symbol) => router.push(ROUTES.trade(symbol))}
        />
      )}
      footer={
        later.length > 0 ? (
          <div className="border-border border-t">
            <p className="px-5 pt-3 pb-1 font-mono text-micro text-muted-foreground uppercase tracking-[0.14em]">
              Not tradeable in {ACTIVE_NETWORK.modeLabel} yet
            </p>
            {later.map((m) => (
              <ArrivingMarketRow key={`${m.venue}-${m.symbol}`} market={m} />
            ))}
          </div>
        ) : null
      }
    />
  );
}
