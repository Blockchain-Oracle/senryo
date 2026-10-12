"use client";
/**
 * Your open positions, live (Tradash's right rail, Owarine's `UnrealizedCard` + `PositionsList`, R5.3): the Unrealized
 * PnL card — the total rolling (decimals by size), its % of what went in, "N unpriced" when some can't be valued now,
 * Close all (N) when more than one can close — then a row per call and ride, newest first, and the parlays in play
 * as a count (they have no live price). One component for the terminal's column, its drawer, Home and Calls.
 */
import type { BookTotals } from "@senryo/calls";
import { useLiveBook } from "@senryo/calls/react";
import { CandlestickChart, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { moneyDecimals, Odometer, viewDollars } from "@/components/ui/odometer";
import { cn } from "@/lib/utils";
import { PositionRow } from "./PositionRow";
import { usePositionClose } from "./usePositionClose";

const BPS_PER_PERCENT = 100;

function UnrealizedCard({
  totals,
  onCloseAll,
  closingAll,
}: {
  totals: BookTotals;
  onCloseAll: () => void;
  closingAll: boolean;
}) {
  const pnl = viewDollars(totals.pnl);
  const allUnpriced = totals.count > 0 && totals.unpriced === totals.count;
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-secondary p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-meta text-text-3">Unrealized PnL</span>
        {totals.closable > 1 ? (
          <button
            type="button"
            onClick={onCloseAll}
            disabled={closingAll}
            className="flex items-center gap-1.5 rounded-full bg-down-surface px-3 py-1 font-semibold text-down text-meta disabled:opacity-50"
          >
            {closingAll ? <LoaderCircle aria-hidden className="size-3.5 animate-spin" /> : null}
            {closingAll ? "Closing…" : `Close all (${totals.closable})`}
          </button>
        ) : null}
      </div>
      {allUnpriced ? (
        <>
          <p className="font-semibold text-text-3 text-title">—</p>
          <p className="text-meta text-text-3">No live value right now</p>
        </>
      ) : (
        <>
          <Odometer
            kind="pnl"
            value={pnl}
            decimals={moneyDecimals(pnl)}
            sensitive
            className="font-semibold text-title"
          />
          {totals.count > 0 ? (
            <span className="flex items-center gap-1.5 text-meta">
              {totals.roiBps !== null ? (
                <Odometer kind="pct" value={totals.roiBps / BPS_PER_PERCENT} decimals={2} />
              ) : null}
              {totals.unpriced > 0 ? <span className="text-text-3">· {totals.unpriced} unpriced</span> : null}
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}

export function PositionsPanel({ className, empty = "card" }: { className?: string; empty?: "card" | "none" }) {
  const book = useLiveBook();
  const actions = usePositionClose();
  const closingAll = actions.closing.size > 1;
  if (book.entries.length === 0 && book.parlays === 0) {
    if (empty === "none") return null;
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3 rounded-2xl bg-secondary p-6", className)}>
        <CandlestickChart aria-hidden className="size-9 text-text-3" strokeWidth={1.5} />
        <span className="text-body text-text-2">{book.ready ? "No open positions" : "Loading positions…"}</span>
      </div>
    );
  }
  return (
    <section aria-label="Open positions" className={cn("flex min-h-0 flex-col gap-2", className)}>
      <UnrealizedCard
        totals={book.totals}
        onCloseAll={() => void actions.closeAll(book.entries)}
        closingAll={closingAll}
      />
      <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
        {book.entries.map((e) => (
          <PositionRow
            key={e.key}
            entry={e}
            closing={actions.closing.has(e.key)}
            onClose={(x) => void actions.close(x)}
          />
        ))}
        {book.parlays > 0 ? (
          <Link
            href="/app/parlay/"
            className="rounded-2xl bg-secondary p-3 font-semibold text-row-title hover:bg-secondary/80"
          >
            {book.parlays === 1 ? "1 parlay in play" : `${book.parlays} parlays in play`}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
