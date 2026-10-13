"use client";
/**
 * One call's receipt (the phone's `CallReceipt`; pivot "Call: see receipt", "the receipt shows entry → exit"): the
 * trade slip (D-331 — folio, the result and its stamp, the facts, the proof; with its row of actions, D-352),
 * then every step with its transaction and the window's proof, all in the shared words (`@senryo/calls`). A live call
 * opens the terminal. `publicView` is the shared link's page: no account needed.
 */
import { callFigure, callFilm, callKey, callLink, callSlip, callSpan, receiptSteps } from "@senryo/calls";
import { type ChainId, networkOf } from "@senryo/config";
import { sideName } from "@senryo/core";
import { historyKeys, useCallTimeline, useWindowProof } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionCircle } from "@/components/ui/action-circle";
import { Button } from "@/components/ui/button";
import { LiveShareSlip, ShareSlip } from "@/features/receipts/ShareSlip";
import { ReplayAction } from "@/features/replay/ReplayAction";
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
  const router = useRouter();
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
  const terminal = `/app/trade/${c.symbol.toLowerCase()}/`;
  const live = (
    <ActionCircle icon={<Activity aria-hidden />} label="Live" primary onClick={() => router.push(terminal)} />
  );
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-start gap-6">
        {slip.live && !publicView ? (
          <LiveShareSlip slip={slip} entryKey={callKey(c.ticketId)} side={sideName(c.band)} lead={live} />
        ) : (
          <ShareSlip
            slip={slip}
            figure={slip.live ? null : callFigure(t)}
            side={sideName(c.band)}
            lead={
              slip.live ? null : (
                <ReplayAction
                  chainId={chainId}
                  bookKey={callKey(c.ticketId)}
                  url={slip.url}
                  span={callSpan(t)}
                  build={(episode, candles) => callFilm(t, episode, { practice, kE8, candles })}
                />
              )
            }
          />
        )}
        {publicView ? (
          <Button asChild size="xl" variant={slip.live ? "default" : "secondary"}>
            <Link href={terminal}>Call {c.symbol} yourself</Link>
          </Button>
        ) : null}
      </div>
      <CallTimeline steps={receiptSteps(t)} chainId={chainId} />
      <WindowProof windowId={c.windowId} chainId={chainId} />
    </div>
  );
}
