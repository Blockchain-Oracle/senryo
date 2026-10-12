"use client";
/**
 * Close part of a position (Codex direction 11 §3: hold CLOSE): 25, 50 or 75 % or all of it, each saying about what it
 * returns now — a call's share of its bid, a ride's share of its close value. The close itself takes the live price
 * within its limit.
 */
import { dollars } from "@senryo/calls";
import { Modal } from "@/components/ui/modal";
import { fire } from "@/lib/feedback";
import { masked, usePrivacy } from "@/lib/shell/privacy";
import { PART_PERCENTS } from "./constants";

const HUNDRED = 100n;

export function PartModal({
  title,
  amountAt,
  onPick,
  onClose,
}: {
  title: string;
  /** About what closing `percent` returns now (null: no price). */
  amountAt: (percent: bigint) => bigint | null;
  onPick: (percent: bigint) => void;
  onClose: () => void;
}) {
  const hidden = usePrivacy();
  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={title} description="Keep the rest riding">
      <div className="flex flex-col">
        {PART_PERCENTS.map((pct) => {
          const v = amountAt(pct);
          const back = v === null ? "—" : masked(dollars(v), hidden);
          return (
            <button
              key={String(pct)}
              type="button"
              disabled={v === null}
              className="flex min-h-14 items-center justify-between rounded-md px-3 font-semibold text-row-title hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40"
              aria-label={`${title} ${pct === HUNDRED ? "all of it" : `${pct} percent`}, about ${back}`}
              onClick={() => {
                fire("press", { cue: "tap" });
                onClose();
                onPick(pct);
              }}
            >
              <span>{pct === HUNDRED ? "All of it" : `${pct}%`}</span>
              <span className="tnum">{back}</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
