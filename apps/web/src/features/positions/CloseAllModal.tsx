"use client";
/**
 * Close all, reviewed first (D-343, Codex direction 15 §3; the phone's `CloseAllSheet`): how many close, what they
 * return together at today's quotes (live while it's open), how many can't, that they close one at a time — and the
 * one control, "Close 2 · $10.08", which then counts through them ("Closing 1 of 2…").
 */
import { type CloseReview, dollars } from "@senryo/calls";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FactList } from "@/components/ui/fact-list";
import { Modal } from "@/components/ui/modal";
import { masked, usePrivacy } from "@/lib/shell/privacy";

export function CloseAllModal({
  review,
  batch,
  open,
  onOpenChange,
  onRun,
}: {
  review: CloseReview;
  batch: { at: number; of: number } | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onRun: () => Promise<void>;
}) {
  const hidden = usePrivacy();
  const n = review.entries.length;
  const estimate = masked(dollars(review.estimate), hidden);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Close ${n} positions`}
      locked={batch !== null}
      footer={
        <Button
          className="w-full"
          disabled={batch !== null}
          onClick={() => void onRun().then(() => onOpenChange(false))}
        >
          {batch ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
          {batch ? `Closing ${batch.at} of ${batch.of}…` : `Close ${n} · ${estimate}`}
        </Button>
      }
    >
      <div className="flex flex-col gap-3 text-body">
        <FactList facts={[{ label: "Estimated return", value: dollars(review.estimate), money: true }]} />
        {review.unavailable > 0 ? (
          <p className="text-meta text-text-3">
            {review.unavailable === 1
              ? "1 position can't close right now."
              : `${review.unavailable} positions can't close right now.`}
          </p>
        ) : null}
        <p className="text-meta text-text-3">Closes one at a time.</p>
      </div>
    </Modal>
  );
}
