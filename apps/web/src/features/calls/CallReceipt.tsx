"use client";
/**
 * One call's receipt (the phone's `CallReceipt`; pivot "Call: see receipt", "the receipt shows entry → exit"): the
 * market and side, the result in dollars, the facts that made it, every step with its transaction, and the window's
 * proof, all in the shared words (`@senryo/calls` `receipt.ts`). A live call says what it is waiting for and opens the
 * terminal; a finished one shares its card. `publicView` is the shared link's page: no account needed.
 */
import { callLink, callTitle, proofCloseE8, receiptFacts, receiptHero, receiptSteps, shareOf } from "@senryo/calls";
import { type ChainId, networkOf } from "@senryo/config";
import { stateWord, whenText } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { historyKeys, useCallTimeline, useWindowProof } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { EntityMark } from "@/components/identity/entity-mark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CallTimeline } from "./CallTimeline";
import { ShareCallButton } from "./ShareCallButton";
import { WindowProof } from "./WindowProof";

const MARK = 44;

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
  const hero = receiptHero(t);
  const mode = networkOf(chainId).modeLabel;
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <EntityMark id={marketId(c.symbol)} size={MARK} decorative />
          <h2 className="font-semibold text-title">{callTitle(c)}</h2>
        </div>
        <p
          className={cn(
            "tnum font-semibold text-display-balance",
            hero.tone === "up" ? "text-up" : hero.tone === "down" ? "text-down" : "text-foreground",
          )}
        >
          {hero.text}
        </p>
        <p className="text-meta text-text-3">
          {stateWord(c)} · {whenText(c.committedAt)} · {mode === "Practice" ? "Practice · test dollars" : "Real · USDC"}
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          {hero.live && !publicView ? (
            <Button asChild size="xl">
              <Link href={`/app/trade/${c.symbol.toLowerCase()}/`}>Watch it live</Link>
            </Button>
          ) : null}
          {!hero.live ? (
            <ShareCallButton
              card={shareOf(
                t,
                mode,
                proofCloseE8("value" in proof ? (proof.value ?? undefined) : undefined),
                callLink(c.ticketId, chainId),
              )}
            />
          ) : null}
          {publicView ? (
            <Button asChild size="xl" variant={hero.live ? "default" : "secondary"}>
              <Link href={`/app/trade/${c.symbol.toLowerCase()}/`}>Call {c.symbol} yourself</Link>
            </Button>
          ) : null}
        </div>
      </header>
      <dl className="flex flex-col">
        {receiptFacts(t).map(([label, value]) => (
          <div key={label} className="flex min-h-12 items-center justify-between gap-3">
            <dt className="text-body text-text-2">{label}</dt>
            <dd className="tnum font-semibold text-row-title">{value}</dd>
          </div>
        ))}
      </dl>
      <CallTimeline steps={receiptSteps(t)} chainId={chainId} />
      <WindowProof windowId={c.windowId} chainId={chainId} />
    </div>
  );
}
