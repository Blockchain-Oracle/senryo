"use client";

import { type EngineMarket, marketPair } from "@senryo/config";
import type { Reading } from "@senryo/core";
import { ids } from "@senryo/identity";
import type { ReactNode } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { Sparkline, WATCHLIST_GRID, WATCHLIST_GRID_COMPACT } from "@/components/ui/market-watchlist";
import { type RetryAction, RetryButton } from "@/components/ui/reading";
import { Skeleton } from "@/components/ui/skeleton";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { arrow, price18, priceDecimalsOf, signedPct } from "@/lib/format";
import type { MarketLine } from "@/lib/markets/line";
import { ageLabel, STATUS_LABEL, statusTone } from "@/lib/markets/session";
import type { ArrivingMarket } from "@/lib/markets/universe";
import { cn } from "@/lib/utils";

const MARK_PX = 32;

const ROW =
  "w-full px-5 py-3 text-left transition-colors duration-(--motion-fast) ease-desk hover:bg-foreground/3 focus-visible:bg-muted focus-visible:outline-none";

/** "20×" on the tinted blue plate — the market's own `maxLeverageX`; none when the engine has no margin parameter. */
export function LeverageBadge({ x }: { x: number }) {
  if (x <= 0) return null;
  return (
    <span className="shrink-0 rounded-xs bg-mainnet-surface px-1 font-mono text-link text-micro">
      {x}×<span className="sr-only"> maximum leverage</span>
    </span>
  );
}

/** A currency reads as its code over its pair ("GBP" over "GBP/USD"); a metal as its name over its ticker. */
export function marketTitles(meta: EngineMarket): { title: string; detail: string } {
  return meta.category === "fx"
    ? { title: meta.symbol, detail: marketPair(meta) }
    : { title: meta.name, detail: meta.symbol };
}

function Identity({
  meta,
  selected,
  badge,
  detail,
}: {
  meta: EngineMarket;
  selected: boolean;
  badge?: number | undefined;
  detail: ReactNode;
}) {
  const { title } = marketTitles(meta);
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className={cn("h-4 w-0.5 shrink-0 rounded-full", selected ? "bg-chart-1" : "bg-transparent")} />
      <EntityMark id={ids.engineMarket(ACTIVE_NETWORK.chainId, meta.id)} size={MARK_PX} decorative />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-semibold text-caption text-foreground">{title}</span>
          {badge !== undefined ? <LeverageBadge x={badge} /> : null}
        </span>
        <span className="block truncate text-micro text-muted-foreground">{detail}</span>
      </span>
    </span>
  );
}

/**
 * One engine market (the phone's `EngineMarketRow`, Fomo F09/F12): the market's own mark, name with its max-leverage
 * badge over ticker · session, a sparkline of hourly Chainlink closes, and the oracle price over its 24 h change with
 * ▲▼ and a sign. Loading and failed are different states (review S05): both still open the market, and a failed read
 * says so with a Retry that shows when it is working.
 */
export function EngineMarketRow({
  meta,
  reading,
  selected,
  now,
  retry,
  onOpen,
  compact = false,
}: {
  meta: EngineMarket;
  reading: Reading<MarketLine>;
  selected: boolean;
  now: bigint;
  retry: RetryAction;
  onOpen: (symbol: string) => void;
  /** No sparkline (`WATCHLIST_GRID_COMPACT`). */
  compact?: boolean;
}) {
  const { detail } = marketTitles(meta);
  const grid = compact ? WATCHLIST_GRID_COMPACT : WATCHLIST_GRID;
  if (reading.status === "unknown" || reading.status === "failed") {
    const failed = reading.status === "failed";
    return (
      <div className={cn(grid, "relative", selected && "bg-chart-1/5")}>
        <button
          type="button"
          onClick={() => onOpen(meta.symbol)}
          aria-label={`${meta.name}, ${failed ? "price unavailable" : "reading the price"}`}
          className={cn(ROW, !compact && "col-span-2", "pr-0")}
        >
          <Identity
            meta={meta}
            selected={selected}
            detail={
              <span className={failed ? "text-warn" : undefined}>
                {failed ? "Price unavailable" : "Reading the oracle"}
              </span>
            }
          />
        </button>
        <span className="flex justify-end pr-5">
          {failed ? (
            <RetryButton retry={retry} label={`Retry reading ${meta.name}`} className="h-7 px-2 text-micro" />
          ) : (
            <span className="grid justify-items-end gap-1">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3 w-12" />
            </span>
          )}
        </span>
      </div>
    );
  }
  const line = reading.value;
  const change = line.change24hBps;
  const up = change === undefined ? undefined : change >= 0n;
  const price = price18(line.price18, priceDecimalsOf(meta.id));
  const changeText = change === undefined ? "24h —" : `${arrow(change)} ${signedPct(change)}`;
  return (
    <button
      type="button"
      onClick={() => onOpen(meta.symbol)}
      aria-pressed={selected}
      aria-label={`${meta.name}, Senryo, ${line.maxLeverageX > 0 ? `up to ${line.maxLeverageX} times leverage, ` : ""}${STATUS_LABEL[line.status]}, price ${price} dollars, updated ${ageLabel(line.updatedAt, now)}${change === undefined ? "" : `, ${up ? "up" : "down"} ${signedPct(change)}`}`}
      className={cn(grid, ROW, selected && "bg-chart-1/5")}
    >
      <Identity
        meta={meta}
        selected={selected}
        badge={line.maxLeverageX}
        detail={
          <>
            {detail} · <span className={statusTone(line.status)}>{STATUS_LABEL[line.status]}</span>
          </>
        }
      />
      {compact ? null : <Sparkline points={line.spark} up={up} />}
      <span className="text-right tabular-nums">
        <span className="block font-semibold text-caption text-foreground">${price}</span>
        <span
          className={cn(
            "font-semibold text-micro",
            up === undefined ? "text-muted-foreground" : up ? "text-chart-up" : "text-chart-down",
          )}
        >
          {changeText}
        </span>
      </span>
    </button>
  );
}

/** A market that isn't tradeable here yet: its real mark and name, and the one short reason — never a price. */
export function ArrivingMarketRow({ market }: { market: ArrivingMarket }) {
  return (
    <div
      role="note"
      aria-label={`${market.name}, ${market.venue}, not tradeable yet: ${market.note}`}
      className="flex items-center gap-3 border-border border-t px-5 py-3 opacity-60"
    >
      <span className="h-4 w-0.5 shrink-0" />
      <EntityMark id={market.mark} size={MARK_PX} label={market.symbol} decorative />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-caption text-foreground">{market.symbol}</span>
        <span className="block truncate text-micro text-muted-foreground">
          {market.name} · {market.venue}
        </span>
      </span>
      <span className="shrink-0 text-micro text-muted-foreground">{market.note}</span>
    </div>
  );
}
