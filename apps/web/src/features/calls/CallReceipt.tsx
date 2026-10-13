"use client";
/**
 * One call's receipt (the phone's `CallReceipt`; pivot "Call: see receipt", "the receipt shows entry → exit"): the
 * trade slip (D-331 — folio, the result and its stamp, the facts, the proof; shared with PnL · ROI · Both, R5.21),
 * then every step with its transaction and the window's proof, all in the shared words (`@senryo/calls`). A live call
 * opens the terminal. `publicView` is the shared link's page: no account needed.
 */
import { callFigure, callFilm, callKey, callLink, callSlip, receiptSteps } from "@senryo/calls";
import { type ChainId, networkOf } from "@senryo/config";
import { sideName } from "@senryo/core";
import { historyKeys, useCallTimeline, useWindowProof } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LiveShareSlip, ShareSlip } from "@/features/receipts/ShareSlip";
import { ReplayVideo } from "@/features/replay/ReplayVideo";
import { CallTimeline } from "./CallTimeline";
import { WindowProof } from "./WindowProof";

export function CallReceipt({
  ticketId,
  chainId,
  publicView = false,
}: {
  ticketId: bigint;
  chainId: ChainId;
  publicView?: boolean;
}) {
  const client = useQueryClient();
  const timeline = useCallTimeline(ticketId);
  const windowId = "value" in timeline ? timeline.value.call.windowId : undefined;
  const proof = useWindowProof(windowId);

  if (!("value" in timeline)) {
    if (timeline.status !== "failed") return <p className="text-body text-text-3">Loading the call…</p>;
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="font-semibold text-row-title">This call isn't in the history yet</p>
        <p className="text-meta text-text-3">It appears a few seconds after it opens.</p>
        <Button
          variant="secondary"
          onClick={() => void client.invalidateQueries({ queryKey: historyKeys.call(chainId, ticketId) })}
        >
          Try again
        </Button>
      </div>
    );
  }
  const t = timeline.value;
  const c = t.call;
  const practice = networkOf(chainId).modeLabel === "Practice";
  const kE8 = "value" in proof ? proof.value?.open?.priceE8 : undefined;
  const slip = callSlip(t, { chainId, practice, kE8, url: callLink(c.ticketId, chainId) });
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-start gap-4">
        {slip.live && !publicView ? (
          <LiveShareSlip slip={slip} entryKey={callKey(c.ticketId)} side={sideName(c.band)} />
        ) : (
          <ShareSlip slip={slip} figure={slip.live ? null : callFigure(t)} side={sideName(c.band)} />
        )}
        {slip.live ? null : (
          <ReplayVideo
            chainId={chainId}
            bookKey={callKey(c.ticketId)}
            url={slip.url}
            build={(episode) => callFilm(t, episode, { practice, kE8 })}
          />
        )}
        <div className="flex flex-wrap gap-2">
          {slip.live && !publicView ? (
            <Button asChild size="xl" variant="secondary">
              <Link href={`/app/trade/${c.symbol.toLowerCase()}/`}>Watch it live</Link>
            </Button>
          ) : null}
          {publicView ? (
            <Button asChild size="xl" variant={slip.live ? "default" : "secondary"}>
              <Link href={`/app/trade/${c.symbol.toLowerCase()}/`}>Call {c.symbol} yourself</Link>
            </Button>
          ) : null}
        </div>
      </div>
      <CallTimeline steps={receiptSteps(t)} chainId={chainId} />
      <WindowProof windowId={c.windowId} chainId={chainId} />
    </div>
  );
}
