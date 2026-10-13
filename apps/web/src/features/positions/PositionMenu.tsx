"use client";
/**
 * A position's secondary actions (D-343, Codex direction 15 §2, §4; the phone's long-press `PositionSheet`): right-click
 * or hold the row for "Position details" and "View receipt" — never a way to close money. Details opens in place as
 * plain key/value rows (entry, the levels, what went in, fees, when it ends), money masked with balances hidden.
 */
import {
  type BookEntry,
  type DetailValue,
  datedText,
  dollars,
  positionDetails,
  positionHead,
  unitOf,
} from "@senryo/calls";
import { priceText } from "@senryo/core";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { fire } from "@/lib/feedback";
import { DRAWERS, openDrawer } from "@/lib/shell/drawer-param";
import { masked, usePrivacy } from "@/lib/shell/privacy";

function Item({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 w-full items-center gap-3 rounded-md px-1 text-left font-medium text-row focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span className="flex-1">{label}</span>
      <ChevronRight aria-hidden className="size-4 text-text-3" />
    </button>
  );
}

export function PositionMenu({
  e,
  open,
  onOpenChange,
}: {
  e: BookEntry;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const hidden = usePrivacy();
  const [details, setDetails] = useState(false);
  const unit = unitOf(e.symbol);
  const text = (v: DetailValue) =>
    v.kind === "price"
      ? v.e8 === null
        ? "—"
        : priceText(v.e8, unit)
      : v.kind === "money"
        ? v.v === null
          ? "—"
          : masked(dollars(v.v), hidden)
        : v.at === null
          ? "—"
          : datedText(v.at);
  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) setDetails(false);
        onOpenChange(o);
      }}
      title={details ? "Position details" : positionHead(e)}
    >
      {details ? (
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-body">
          {positionDetails(e).map((d) => (
            <div key={d.label} className="contents">
              <dt className="text-text-3">{d.label}</dt>
              <dd className="tnum text-right font-semibold">{text(d.value)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="flex flex-col">
          <Item
            label="Position details"
            onClick={() => {
              fire("tick", { cue: "tap" });
              setDetails(true);
            }}
          />
          <Item
            label="View receipt"
            onClick={() => {
              fire("tick", { cue: "tap" });
              onOpenChange(false);
              openDrawer(e.kind === "ride" ? DRAWERS.ride : DRAWERS.call, { id: String(e.id) });
            }}
          />
        </div>
      )}
    </Modal>
  );
}
