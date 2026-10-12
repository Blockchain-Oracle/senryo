"use client";
/**
 * A trade of this session that has ended (R5.11): its slip in the positions list under "Just finished" — the receipt
 * itself, stamped (pressed once if it has just ended) — with its receipt and Dismiss.
 */
import { dismissFinished, type FinishedTrade, useFinishedSlip } from "@senryo/calls/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { tapFeedback } from "@/lib/feedback";
import { DRAWERS, openDrawer } from "@/lib/shell/drawer-param";
import { TradeSlip } from "./TradeSlip";

/** A result this fresh presses its stamp as it appears; older ones show it at rest. */
const FRESH_MS = 4_000;

export function FinishedSlip({ run }: { run: FinishedTrade }) {
  const slip = useFinishedSlip(run);
  const [fresh] = useState(() => Date.now() - run.at < FRESH_MS);
  if (!slip) return null;
  return (
    <div className="flex flex-col gap-2">
      <TradeSlip slip={slip} press={fresh && !slip.live} />
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            tapFeedback();
            openDrawer(run.instrument === "call" ? DRAWERS.call : DRAWERS.ride, { id: String(run.id) });
          }}
        >
          Receipt
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            tapFeedback();
            dismissFinished(run);
          }}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
