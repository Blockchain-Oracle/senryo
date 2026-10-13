"use client";
/**
 * A slip with its share (R5.21; Owarine's `ShareSheet` on the trade slip, D-331): PnL · ROI · Both changes the slip's
 * figure, the image and the post alike; Share and Save image export the slip as shown; Post on X opens a post with
 * the result's tiered words and the slip's link. An open position shares what it's worth now from the live book
 * (`LiveShareSlip`); without a figure (a live slip on the public page) the slip stands alone. Everything waits while
 * balances are hidden (D-329).
 */
import {
  bookFigure,
  postLink,
  SHARE_MODES,
  type ShareFigure,
  type ShareMode,
  type TradeSlip as Slip,
  sharedSlip,
  shareWords,
} from "@senryo/calls";
import { useBookEntry } from "@senryo/calls/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { fire } from "@/lib/feedback";
import { notify } from "@/lib/notify";
import { usePrivacy } from "@/lib/shell/privacy";
import { SlipActions } from "./SlipActions";
import { TradeSlip } from "./TradeSlip";

const BLOCKED = { title: "Balances are hidden", description: "Show balances to share this trade." };

export function ShareSlip({ slip, figure, side }: { slip: Slip; figure: ShareFigure | null; side: string }) {
  const [mode, setMode] = useState<ShareMode>("both");
  const hidden = usePrivacy();
  if (!figure) return <TradeSlip slip={slip} />;
  const shown = sharedSlip(slip, figure, mode);
  const post = () => {
    fire("press", { cue: "tap" });
    if (hidden) return notify(BLOCKED);
    window.open(postLink(shareWords(figure, slip.symbol, side), slip.url), "_blank", "noopener,noreferrer");
  };
  return (
    <div className="flex flex-col items-start gap-4">
      <TradeSlip slip={shown} />
      <SegmentedControl
        options={SHARE_MODES}
        label="What the share shows"
        value={mode}
        onValueChange={(v) => setMode(v as ShareMode)}
      />
      <div className="flex flex-wrap gap-2">
        <SlipActions slip={shown} />
        <Button size="xl" onClick={post}>
          Post on X
        </Button>
      </div>
    </div>
  );
}

/** An open position's slip, shared at what the live book says it's worth now (the slip alone while unvalued). */
export function LiveShareSlip({ slip, entryKey, side }: { slip: Slip; entryKey: string; side: string }) {
  const entry = useBookEntry(entryKey);
  return <ShareSlip slip={slip} figure={entry ? bookFigure(entry) : null} side={side} />;
}
