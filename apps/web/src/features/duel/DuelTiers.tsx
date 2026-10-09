"use client";
/**
 * The duel's entry (S8.6; Owarine's Entry): the tiers as rows — free, or a pot the winner takes — each saying what
 * three calls cost and what goes in now, then Find a duel (one passkey: the entry and its permit). Until the arena is
 * on this network the rows stay readable and the button says why it waits.
 */
import { entryText, tierLine, tierTitle } from "@senryo/calls";
import { type DuelTierSpec, duelEntryCost } from "@senryo/config";
import { usd } from "@senryo/core";
import { fire } from "@/lib/feedback";
import { cn } from "@/lib/utils";

export function DuelTiers(p: {
  tiers: readonly DuelTierSpec[];
  tier: number;
  onTier: (id: number) => void;
  onEnter: () => void;
  live: boolean;
  busy: string | null;
  balance: bigint | undefined;
}) {
  const chosen = p.tiers.find((t) => t.id === p.tier) ?? p.tiers[0];
  const cost = chosen ? duelEntryCost(chosen) : 0n;
  const short = p.balance !== undefined && p.balance < cost;
  const why = !p.live
    ? "Duels open when the arena is on chain (the next markets deploy)"
    : short
      ? "Not enough dollars for this duel"
      : null;
  return (
    <section aria-label="Start a duel" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-section-title">Start a duel</h2>
        <p className="text-body text-text-2">Three cards each · Up or Down · the better total takes the pot</p>
      </div>
      <fieldset className="m-0 flex min-w-0 flex-col divide-y divide-border border-0 p-0">
        <legend className="sr-only">Tier</legend>
        {p.tiers.map((t) => {
          const on = t.id === chosen?.id;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                fire("tick", { cue: "tap" });
                p.onTier(t.id);
              }}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                on ? "bg-selected-row" : "hover:bg-row-pressed",
              )}
            >
              <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", on ? "bg-primary" : "bg-secondary")} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold text-row-title">{tierTitle(t)}</span>
                <span className="text-meta text-text-3">{tierLine(t)}</span>
              </span>
              <span className="tnum text-meta text-text-2">{entryText(t)}</span>
            </button>
          );
        })}
      </fieldset>
      <p className="min-h-5 text-meta text-text-3" role="status" aria-live="polite">
        {p.busy ?? why ?? "Every card is a real call · results pay as each window closes"}
      </p>
      <button
        type="button"
        disabled={why !== null || p.busy !== null}
        onClick={p.onEnter}
        className="h-14 rounded-xl bg-primary font-semibold text-button text-primary-foreground transition-transform active:scale-97 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
      >
        Find a duel · {usd(cost)}
      </button>
    </section>
  );
}
