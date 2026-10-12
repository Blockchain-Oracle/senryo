"use client";
/**
 * The focused trade in the View-position pill's place (R5.11, Codex direction 12 §1, under 1024 px): a trade on its
 * way ("Waiting for the fill") or the one that just ended (its realised figure and its stamp's words) as a small
 * paper; a tap opens the positions with it. Nothing ended or on its way: the pill.
 */
import type { FinishedTrade, PendingTrade } from "@senryo/calls/react";
import { useFinishedSlip } from "@senryo/calls/react";
import { marketId } from "@senryo/identity";
import { LoaderCircle } from "lucide-react";
import { EntityMark } from "@/components/identity/entity-mark";
import { tapFeedback } from "@/lib/feedback";
import { HIDDEN_AMOUNT, usePrivacy } from "@/lib/shell/privacy";
import { cn } from "@/lib/utils";
import "./receipts.css";

const MARK = 28;

export function CompactTrade({
  pending,
  finished,
  onOpen,
}: {
  pending: PendingTrade | undefined;
  finished: FinishedTrade | undefined;
  onOpen: () => void;
}) {
  const slip = useFinishedSlip(pending ? undefined : finished);
  const hidden = usePrivacy();
  const symbol = pending?.symbol ?? slip?.symbol;
  if (!symbol) return null;
  const title = pending?.title ?? slip?.title ?? "";
  const line = pending
    ? pending.stage === "signing"
      ? "Signing…"
      : "Waiting for the fill"
    : slip
      ? `${slip.figure.label} ${hidden ? HIDDEN_AMOUNT : slip.figure.text}`
      : "";
  return (
    <button
      type="button"
      className="receipt receipt-compact"
      aria-label={`${title}, ${line}. Open positions`}
      onClick={() => {
        tapFeedback();
        onOpen();
      }}
    >
      <EntityMark id={marketId(symbol)} size={MARK} decorative />
      <span className="receipt-compact-text">
        <span className="receipt-compact-title">{title}</span>
        <span
          className={cn(
            "receipt-compact-line",
            !pending && slip?.figure.tone === "up" && "is-up",
            !pending && slip?.figure.tone === "down" && "is-down",
          )}
        >
          {pending ? <LoaderCircle aria-hidden className="size-3.5 animate-spin" /> : null}
          {line}
        </span>
      </span>
      {!pending && slip?.stamp ? <span className="receipt-chip">{slip.stamp.lines.join(" ")}</span> : null}
    </button>
  );
}
