"use client";
/**
 * Cash out part of a call (the phone's `CashOutSheet`, a centred modal on the web): 25 %, 50 % or all of it, each
 * saying what it returns at the bid the modal opened on; the call itself takes the live bid less the tolerance.
 */
import { formatUnits, proceedsFor } from "@senryo/core";
import { Modal } from "@/components/ui/modal";
import { fire } from "@/lib/feedback";
import { CASH_OUT_PARTS } from "./constants";

const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const HUNDRED = 100n;

export function CashOutModal({
  shares,
  bidE6,
  onPick,
  onClose,
}: {
  shares: bigint;
  bidE6: bigint;
  onPick: (percent: bigint) => void;
  onClose: () => void;
}) {
  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title="Cash out" description="Keep the rest riding">
      <div className="flex flex-col">
        {CASH_OUT_PARTS.map((pct) => {
          const back = `$${formatUnits(proceedsFor((shares * pct) / HUNDRED, bidE6), DOLLAR_DECIMALS, CENTS)}`;
          return (
            <button
              key={String(pct)}
              type="button"
              className="flex min-h-14 items-center justify-between rounded-md px-3 text-row-title font-semibold hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
              aria-label={`Cash out ${pct} percent, about ${back}`}
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
