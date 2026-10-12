"use client";
/**
 * The duel tiers as tiles (P4, D-323; the phone's `TierCarousel`): each names its pot ("No pot", "$10 pot"), its three
 * calls' stake and how many wait in it now; the row snaps tile by tile. The chosen tile is filled, and its commitment
 * is spelled out below.
 */
import { commitment, tierTitle, waitingText } from "@senryo/calls";
import { DUEL, type DuelTierSpec } from "@senryo/config";
import { usdTidy } from "@senryo/core";
import { fire } from "@/lib/feedback";
import { cn } from "@/lib/utils";

export function DuelTiers({
  tiers,
  value,
  onChange,
  waiting,
}: {
  tiers: readonly DuelTierSpec[];
  value: number;
  onChange: (id: number) => void;
  waiting: ReadonlyMap<number, number> | undefined;
}) {
  const chosen = tiers.find((t) => t.id === value) ?? tiers[0];
  const words = chosen ? commitment(chosen) : null;
  const count = (id: number) => (waiting ? (waiting.get(id) ?? 0) : undefined);
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="m-0 flex min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto border-0 p-0 pb-1 [scrollbar-width:none]">
        <legend className="sr-only">Duel tier</legend>
        {tiers.map((t) => {
          const on = t.id === chosen?.id;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                if (on) return;
                fire("tick", { cue: "tap" });
                onChange(t.id);
              }}
              className={cn(
                "press-lift flex h-28 w-33 shrink-0 snap-start flex-col justify-between rounded-2xl p-4 text-left focus-visible:outline-2 focus-visible:outline-ring",
                on ? "bg-accent text-accent-foreground" : "bg-secondary hover:bg-accent/20",
              )}
            >
              <span className="font-semibold text-title">{tierTitle(t)}</span>
              <span className={cn("text-meta", on ? "opacity-90" : "text-text-3")}>
                {DUEL.cards} × {usdTidy(t.cardStake)} calls
              </span>
              <span className={cn("text-micro", on ? "opacity-90" : "text-text-3")}>{waitingText(count(t.id))}</span>
            </button>
          );
        })}
      </fieldset>
      {words ? (
        <div aria-live="polite" className="flex flex-col gap-0.5">
          <span className="tnum font-semibold text-row-title">{words.sum}</span>
          <span className="text-meta text-text-3">{words.note}</span>
        </div>
      ) : null}
    </div>
  );
}
