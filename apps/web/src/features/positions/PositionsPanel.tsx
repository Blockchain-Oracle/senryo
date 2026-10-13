"use client";
/**
 * Your open positions, live (D-343, Codex direction 15 §3, §7; the phone's `PositionsList`): one grounded group — a
 * quiet Unrealized header (the total rolling, its ROI, "N unpriced" when some can't be valued; "Close all (3)" or
 * "Close available (2)" as plain text when two or more can close, opening a review) over a live row per call and ride.
 * Around it: a trade on its way as its pending paper (R5.11), the parlays in play as a count, this session's ended
 * trades under "Just finished". One component for the terminal's column, its drawer, Home and Calls.
 */
import { type BookTotals, closeReview, roiText } from "@senryo/calls";
import { useLiveBook, useTradeRuns } from "@senryo/calls/react";
import { CandlestickChart } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { moneyDecimals, Odometer, viewDollars } from "@/components/ui/odometer";
import { FinishedSlip } from "@/features/receipts/FinishedSlip";
import { PendingTradeCard } from "@/features/receipts/PendingTradeCard";
import { fire } from "@/lib/feedback";
import { masked, usePrivacy } from "@/lib/shell/privacy";
import { cn } from "@/lib/utils";
import { CloseAllModal } from "./CloseAllModal";
import { PositionRow } from "./PositionRow";
import { usePositionClose } from "./usePositionClose";

function Unrealized({ totals, action, onReview }: { totals: BookTotals; action: string | null; onReview: () => void }) {
  const hidden = usePrivacy();
  const pnl = viewDollars(totals.pnl);
  const allUnpriced = totals.count > 0 && totals.unpriced === totals.count;
  const roi = totals.roiBps === null ? null : roiText(totals.roiBps);
  const unpriced = totals.unpriced > 0 ? `${totals.unpriced} unpriced` : null;
  return (
    <div className="flex flex-col gap-0.5 px-3 pt-3 pb-1">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-meta text-text-3">Unrealized PnL</span>
        {action ? (
          <button
            type="button"
            onClick={() => {
              fire("tick", { cue: "tap" });
              onReview();
            }}
            className="rounded-md px-1 font-semibold text-row focus-visible:outline-2 focus-visible:outline-ring"
          >
            {action}
          </button>
        ) : null}
      </div>
      {allUnpriced ? (
        <>
          <p className="font-display text-position-total text-text-3">—</p>
          <p className="text-meta text-text-3">No live value right now</p>
        </>
      ) : (
        <>
          <Odometer kind="pnl" value={pnl} decimals={moneyDecimals(pnl)} sensitive className="text-position-total" />
          {roi || unpriced ? (
            <span className="tnum text-meta">
              {roi ? (
                <span className={hidden ? "text-text-3" : totals.pnl >= 0n ? "text-up" : "text-down"}>
                  {masked(roi, hidden)}
                </span>
              ) : null}
              {unpriced ? <span className="text-text-3">{roi ? ` · ${unpriced}` : unpriced}</span> : null}
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}

export function PositionsPanel({
  className,
  empty = "card",
  onPick,
}: {
  className?: string;
  empty?: "card" | "none";
  /** A row opened its trade (the drawer closes itself). */
  onPick?: () => void;
}) {
  const book = useLiveBook();
  const actions = usePositionClose();
  const [reviewing, setReviewing] = useState(false);
  const review = closeReview(book.entries);
  // The review keeps what it showed while its run empties the list under it.
  const shown = useRef(review);
  if (review) shown.current = review;
  const runs = useTradeRuns((instrument, id) => book.entries.some((e) => e.kind === instrument && e.id === id));
  const quiet = runs.pending.length === 0 && runs.finished.length === 0;
  if (book.entries.length === 0 && book.parlays === 0 && quiet) {
    if (empty === "none") return null;
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3 rounded-2xl bg-secondary p-6", className)}>
        <CandlestickChart aria-hidden className="size-9 text-text-3" strokeWidth={1.5} />
        <span className="text-body text-text-2">{book.ready ? "No open positions" : "Loading positions…"}</span>
      </div>
    );
  }
  const current = review ?? shown.current;
  return (
    <section aria-label="Open positions" className={cn("flex min-h-0 flex-col gap-2", className)}>
      <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
        {runs.pending.map((run) => (
          <PendingTradeCard key={run.key} run={run} />
        ))}
        {book.entries.length > 0 ? (
          <div className="rounded-2xl bg-secondary pb-1">
            <Unrealized totals={book.totals} action={review?.action ?? null} onReview={() => setReviewing(true)} />
            {book.entries.map((e) => (
              <PositionRow
                key={e.key}
                entry={e}
                closing={actions.closing.has(e.key)}
                onClose={(x) => void actions.close(x)}
                {...(onPick ? { onPick } : {})}
              />
            ))}
          </div>
        ) : null}
        {book.parlays > 0 ? (
          <Link
            href="/app/parlay/"
            className="rounded-2xl bg-secondary p-3 font-semibold text-row-title hover:bg-secondary/80"
          >
            {book.parlays === 1 ? "1 parlay in play" : `${book.parlays} parlays in play`}
          </Link>
        ) : null}
        {runs.finished.length > 0 ? (
          <>
            <h3 className="pt-2 text-meta text-text-3">Just finished</h3>
            {runs.finished.map((run) => (
              <FinishedSlip key={`${run.instrument}-${run.id}`} run={run} />
            ))}
          </>
        ) : null}
      </div>
      {current ? (
        <CloseAllModal
          review={current}
          batch={actions.batch}
          open={reviewing}
          onOpenChange={setReviewing}
          onRun={() => actions.closeAll(current.entries)}
        />
      ) : null}
    </section>
  );
}
