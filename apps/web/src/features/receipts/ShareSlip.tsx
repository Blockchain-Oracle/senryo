"use client";
/**
 * A receipt with its actions (R5.21, D-352; Codex direction 18 §A; the phone's `ShareSlip`): the slip, then one row of
 * action circles — the lead (Replay ▶ for a finished trade, Live for an open one), Post with X's own mark (a post with
 * the result's tiered words and the slip's link), Share and Save (the slip as an image). The slip always shows the PnL
 * with its ROI; an open position shows what it's worth now from the live book (`LiveShareSlip`). Without a figure (a
 * live slip on the public page) the slip stands alone. Everything waits while balances are hidden (D-329).
 */
import { bookFigure, postLink, type ShareFigure, type TradeSlip as Slip, sharedSlip, shareWords } from "@senryo/calls";
import { useBookEntry } from "@senryo/calls/react";
import { ids } from "@senryo/identity";
import { Download, Share2 } from "lucide-react";
import type { ReactNode } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { ActionCircle, ActionCircles } from "@/components/ui/action-circle";
import { fire } from "@/lib/feedback";
import { notify } from "@/lib/notify";
import { usePrivacy } from "@/lib/shell/privacy";
import { TradeSlip } from "./TradeSlip";
import { useSlipImage } from "./useSlipImage";

const BLOCKED = { title: "Balances are hidden", description: "Show balances to share this trade." };
const ICON = 24;

export function ShareSlip({
  slip,
  figure,
  side,
  lead,
}: {
  slip: Slip;
  figure: ShareFigure | null;
  side: string;
  /** The row's first circle: Replay, or Live for an open trade; none on a public page. */
  lead?: ReactNode;
}) {
  const hidden = usePrivacy();
  const shown = figure ? sharedSlip(slip, figure) : slip;
  const image = useSlipImage(shown);
  if (!figure && !lead) return <TradeSlip slip={slip} />;
  const post = () => {
    fire("press", { cue: "tap" });
    if (hidden) return notify(BLOCKED);
    if (figure) window.open(postLink(shareWords(figure, slip.symbol, side), slip.url), "_blank", "noopener,noreferrer");
  };
  return (
    <div className="flex w-full max-w-[26rem] flex-col items-stretch gap-6">
      <TradeSlip slip={shown} />
      <ActionCircles>
        {lead}
        <ActionCircle
          icon={<EntityMark id={ids.brand("x")} size={ICON} variant="mono" decorative />}
          label="Post"
          accessibleName="Post on X"
          {...(figure ? {} : { reason: "" })}
          onClick={post}
        />
        <ActionCircle icon={<Share2 aria-hidden />} label="Share" busy={image.busy === "share"} onClick={image.share} />
        <ActionCircle icon={<Download aria-hidden />} label="Save" busy={image.busy === "save"} onClick={image.save} />
      </ActionCircles>
      {image.node}
    </div>
  );
}

/** An open position's slip, shared at what the live book says it's worth now (unvalued: no post yet). */
export function LiveShareSlip({
  slip,
  entryKey,
  side,
  lead,
}: {
  slip: Slip;
  entryKey: string;
  side: string;
  lead?: ReactNode;
}) {
  const entry = useBookEntry(entryKey);
  return <ShareSlip slip={slip} figure={entry ? bookFigure(entry) : null} side={side} lead={lead} />;
}
