"use client";

// 21st: ssychui/market-watchlist (#20110) — https://21st.dev/@ssychui/components/market-watchlist
// Re-tokenized for D2 Desk: hairline border, 4px radius, full width, selection accent = --chart-1 (D2 yellow),
// up/down from --chart-up/--chart-down. Data-driven (no demo assets inside); `onSelect` lets rows route to a ticket.

import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type WatchlistAsset = {
  symbol: string;
  /** second line, e.g. "Open · 20x max" */
  name: string;
  price: number;
  /** % change over the list's window */
  change: number;
  /** sparkline samples, oldest → newest */
  points: readonly number[];
};

export interface MarketWatchlistProps {
  assets: readonly WatchlistAsset[];
  title?: string;
  initial?: string;
  onSelect?: (symbol: string) => void;
  formatPrice?: (price: number) => string;
  className?: string;
}

const SPARK_W = 80;
const SPARK_H = 30;
const SPARK_PAD_X = 2;
const SPARK_PAD_Y = 3;
const SPARK_INNER_W = 76;
const SPARK_INNER_H = 23;
const SMALL_PRICE = 10;
const SMALL_DP = 4;
const DP = 2;
const CARET = 10;

const defaultPrice = (p: number) =>
  p < SMALL_PRICE
    ? `$${p.toFixed(SMALL_DP)}`
    : `$${p.toLocaleString("en-US", { minimumFractionDigits: DP, maximumFractionDigits: DP })}`;

function Sparkline({ points, up }: { points: readonly number[]; up: boolean }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const last = Math.max(1, points.length - 1);
  const d = points
    .map((v, i) => {
      const x = SPARK_PAD_X + (i / last) * SPARK_INNER_W;
      const y = SPARK_PAD_Y + (1 - (v - min) / (max - min || 1)) * SPARK_INNER_H;
      return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} className="h-7 w-20" aria-hidden>
      <path
        d={d}
        fill="none"
        stroke={up ? "var(--chart-up)" : "var(--chart-down)"}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const GRID = "grid grid-cols-[minmax(0,1fr)_5rem_5.75rem] items-center";

export default function MarketWatchlist({
  assets,
  title = "Market watchlist",
  initial,
  onSelect,
  formatPrice = defaultPrice,
  className,
}: MarketWatchlistProps) {
  const [sort, setSort] = useState<"symbol" | "change">("change");
  const [descending, setDescending] = useState(true);
  const [active, setActive] = useState(initial ?? assets[0]?.symbol);

  const rows = useMemo(
    () =>
      [...assets].sort((a, b) => {
        const r = sort === "change" ? a.change - b.change : a.symbol.localeCompare(b.symbol);
        return descending ? -r : r;
      }),
    [sort, descending, assets],
  );

  const changeSort = (next: "symbol" | "change") => {
    if (sort === next) setDescending((v) => !v);
    else {
      setSort(next);
      setDescending(next === "change");
    }
  };
  const caret = (on: boolean) => (on ? descending ? <ChevronDown size={CARET} /> : <ChevronUp size={CARET} /> : null);

  return (
    <div className={cn("w-full overflow-hidden rounded-lg border border-border bg-card", className)}>
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h3 className="text-num-sm font-semibold text-foreground">{title}</h3>
        <span className="text-micro text-muted-foreground">{assets.length} assets</span>
      </div>
      <div className={cn(GRID, "border-b border-border px-5 py-2 text-micro tracking-[0.07em] text-muted-foreground")}>
        <button type="button" onClick={() => changeSort("symbol")} className="flex items-center gap-1 text-left">
          Asset {caret(sort === "symbol")}
        </button>
        <span className="text-center">Trend</span>
        <button type="button" onClick={() => changeSort("change")} className="flex items-center justify-end gap-1">
          Change {caret(sort === "change")}
        </button>
      </div>
      {rows.map((asset) => {
        const selected = active === asset.symbol;
        const up = asset.change >= 0;
        return (
          <button
            key={asset.symbol}
            type="button"
            aria-pressed={selected}
            aria-label={`${asset.symbol}, ${formatPrice(asset.price)}, ${up ? "up" : "down"} ${Math.abs(asset.change).toFixed(DP)}%`}
            onClick={() => {
              setActive(asset.symbol);
              onSelect?.(asset.symbol);
            }}
            className={cn(
              GRID,
              "w-full border-b border-border px-5 py-3 text-left transition-colors duration-(--motion-fast) ease-desk last:border-b-0 hover:bg-foreground/3",
              selected && "bg-chart-1/5",
            )}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className={cn("h-4 w-0.5 shrink-0 rounded-full", selected ? "bg-chart-1" : "bg-foreground/12")} />
              <span className="min-w-0">
                <span className="block text-caption font-semibold text-foreground">{asset.symbol}</span>
                <span className="block truncate text-micro text-muted-foreground">{asset.name}</span>
              </span>
            </span>
            <Sparkline points={asset.points} up={up} />
            <span className="text-right tabular-nums">
              <span className="block text-caption font-semibold text-foreground">{formatPrice(asset.price)}</span>
              <span className={cn("text-micro font-semibold", up ? "text-chart-up" : "text-chart-down")}>
                {up ? "▲ +" : "▼ "}
                {asset.change.toFixed(DP)}%
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { MarketWatchlist };
