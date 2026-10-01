"use client";

// 21st: ssychui/market-watchlist (#20110) — https://21st.dev/@ssychui/components/market-watchlist
// Re-tokenized for D2 Desk: hairline border, 4px radius, full width, selection accent = --chart-1 (D2 yellow),
// up/down from --chart-up/--chart-down. S11b: the shell (title, count, sortable column header) is data-agnostic — each
// row is rendered by the screen from its own Reading, so a loading or failed market keeps its place in the list.

import { ChevronDown, ChevronUp } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type WatchlistRow = {
  key: string;
  /** Sort by Asset. */
  name: string;
  /** Sort by Change (plot-only percent); undefined sorts last. */
  change?: number | undefined;
};

export interface MarketWatchlistProps<T extends WatchlistRow> {
  rows: readonly T[];
  renderRow: (row: T, selected: boolean) => ReactNode;
  title?: string;
  /** The row the page is about (the trade route's market). */
  selected?: string | undefined;
  /** Rows that never sort (markets not tradeable here yet), drawn under the list. */
  footer?: ReactNode;
  /** No trend column (rows must use `WATCHLIST_GRID_COMPACT` too). */
  compact?: boolean;
  className?: string | undefined;
}

const SPARK_W = 80;
const SPARK_H = 30;
const SPARK_PAD_X = 2;
const SPARK_PAD_Y = 3;
const SPARK_INNER_W = 76;
const SPARK_INNER_H = 23;
const SPARK_MIN_POINTS = 2;
const CARET = 10;

export function Sparkline({ points, up }: { points: readonly number[]; up: boolean | undefined }) {
  if (points.length < SPARK_MIN_POINTS) return <span aria-hidden className="h-7 w-20" />;
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
  const stroke = up === undefined ? "var(--chart-neutral)" : up ? "var(--chart-up)" : "var(--chart-down)";
  return (
    <svg viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} className="h-7 w-20" aria-hidden>
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export const WATCHLIST_GRID = "grid grid-cols-[minmax(0,1fr)_5rem_6.5rem] items-center";
/** A narrow column (the trade page's sidebar) drops the sparkline so names and sessions don't truncate. */
export const WATCHLIST_GRID_COMPACT = "grid grid-cols-[minmax(0,1fr)_6.5rem] items-center";

type Sort = "listed" | "symbol" | "change";

export default function MarketWatchlist<T extends WatchlistRow>({
  rows,
  renderRow,
  title = "Market watchlist",
  selected,
  footer,
  compact = false,
  className,
}: MarketWatchlistProps<T>) {
  const [sort, setSort] = useState<Sort>("listed");
  const [descending, setDescending] = useState(true);

  const sorted = useMemo(() => {
    if (sort === "listed") return rows;
    return [...rows].sort((a, b) => {
      if (sort === "symbol") return (descending ? -1 : 1) * a.name.localeCompare(b.name);
      if (a.change === undefined) return b.change === undefined ? 0 : 1;
      if (b.change === undefined) return -1;
      return (descending ? -1 : 1) * (a.change - b.change);
    });
  }, [sort, descending, rows]);

  const changeSort = (next: Exclude<Sort, "listed">) => {
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
        <span className="text-micro text-muted-foreground">{rows.length} markets</span>
      </div>
      <div
        className={cn(
          compact ? WATCHLIST_GRID_COMPACT : WATCHLIST_GRID,
          "border-b border-border px-5 py-2 text-micro tracking-[0.07em] text-muted-foreground",
        )}
      >
        <button
          type="button"
          onClick={() => changeSort("symbol")}
          aria-pressed={sort === "symbol"}
          className="flex items-center gap-1 text-left"
        >
          Asset {caret(sort === "symbol")}
        </button>
        {compact ? null : <span className="text-center">24h</span>}
        <button
          type="button"
          onClick={() => changeSort("change")}
          aria-pressed={sort === "change"}
          className="flex items-center justify-end gap-1"
        >
          Change {caret(sort === "change")}
        </button>
      </div>
      <ul>
        {sorted.map((row) => (
          <li key={row.key} className="border-b border-border last:border-b-0">
            {renderRow(row, row.key === selected)}
          </li>
        ))}
      </ul>
      {footer}
    </div>
  );
}

export { MarketWatchlist };
