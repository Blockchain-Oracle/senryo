"use client";
/**
 * Tradash's phone pill under 1024 px (R5.3): "View position" / "View N positions" with the total ROI rolling and an
 * arrow by its sign; opens the positions drawer. A trade on its way, or one that just ended, stands in its place as a
 * small paper (`CompactTrade`, R5.11). Nothing while nothing is open.
 */
import { useLiveBook, useTradeRuns } from "@senryo/calls/react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Odometer } from "@/components/ui/odometer";
import { CompactTrade } from "@/features/receipts/CompactTrade";
import { tapFeedback } from "@/lib/feedback";

const BPS_PER_PERCENT = 100;

export function PositionsPill({ onOpen }: { onOpen: () => void }) {
  const { totals, entries } = useLiveBook();
  const runs = useTradeRuns((instrument, id) => entries.some((e) => e.kind === instrument && e.id === id));
  const pending = runs.pending[0];
  const finished = runs.focused ?? undefined;
  if (pending || finished) return <CompactTrade pending={pending} finished={finished} onOpen={onOpen} />;
  if (totals.count === 0) return null;
  const roi = totals.roiBps;
  const Icon = roi !== null && roi < 0 ? TrendingDown : TrendingUp;
  return (
    <button
      type="button"
      className="terminal-positions-pill"
      onClick={() => {
        tapFeedback();
        onOpen();
      }}
    >
      <Icon aria-hidden className={roi !== null && roi < 0 ? "size-4 text-down" : "size-4 text-up"} />
      {totals.count === 1 ? "View position" : `View ${totals.count} positions`}
      {roi !== null ? <Odometer kind="pct" value={roi / BPS_PER_PERCENT} decimals={1} sensitive /> : null}
    </button>
  );
}
