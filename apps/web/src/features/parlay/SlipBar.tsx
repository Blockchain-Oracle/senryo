"use client";
/**
 * The slip, folded (P3, D-326; the phone's `SlipBar`, Mitoshi's slip pill): on screens without the slip rail, a bar
 * floats over the bottom — above the phone dock — from the first visit: "Choose your first leg", then the legs' marks,
 * how many and what the parlay pays, with the way in ("Add one more", "Review parlay"). It opens the slip drawer.
 */
import { type ParlayPick, slipBarWords } from "@senryo/calls";
import { marketId } from "@senryo/identity";
import { EntityMark } from "@/components/identity/entity-mark";
import { cn } from "@/lib/utils";

const MARK = 28;

export function SlipBar({
  picks,
  price,
  trading,
  onOpen,
}: {
  picks: readonly ParlayPick[];
  /** "Pays 3.84× · About 26%" once priced (never between rounds). */
  price: string | null;
  trading: boolean;
  onOpen: () => void;
}) {
  const words = slipBarWords(picks.length, price, trading);
  const ready = words.action !== null && picks.length > 1;
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={picks.length === 0}
      aria-label={`${words.title}. ${words.detail}${words.action ? `. ${words.action}` : ""}`}
      className="fixed inset-x-3 bottom-[calc(var(--spacing)*24+env(safe-area-inset-bottom,0))] z-40 flex min-h-18 items-center gap-3 rounded-3xl bg-popover px-4 py-3 text-left shadow-(--elevation-sheet) focus-visible:outline-2 focus-visible:outline-ring md:bottom-4 md:left-[calc(var(--rail-compact)+var(--shell-inset)*2)] lg:hidden"
    >
      <span className="flex items-center">
        {picks.length === 0 ? (
          <span className="size-7 rounded-full bg-secondary" />
        ) : (
          picks.map((p, i) => (
            <span key={p.symbol} className={cn("rounded-full", i > 0 && "-ml-2.5")}>
              <EntityMark id={marketId(p.symbol)} size={MARK} decorative />
            </span>
          ))
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold text-row-title">{words.title}</span>
        <span className="tnum truncate text-meta text-text-3">{words.detail}</span>
      </span>
      {words.action ? (
        <span
          className={cn(
            "rounded-full px-4 py-2.5 font-semibold text-button-compact",
            ready ? "bg-primary text-primary-foreground" : "bg-secondary",
          )}
        >
          {words.action}
        </span>
      ) : null}
    </button>
  );
}
