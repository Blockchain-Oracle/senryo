"use client";
/**
 * Your parlays (S8.5): each slip with its big line (what it pays while live, the result once done), where it stands,
 * and every leg with its outcome as it settles — newest first; rows, not boxes.
 */
import { LEG_WORD, parlayHero, parlayStatus, pickLine } from "@senryo/calls";
import { usd } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useParlays } from "@senryo/query";
import { EntityMark } from "@/components/identity/entity-mark";
import { cn } from "@/lib/utils";

const MARK = 24;
const TONE = { up: "text-up", down: "text-down", ink: "text-foreground" } as const;
const LEG_TONE = { won: "text-up", lost: "text-down" } as const;

export function ParlayList({ owner }: { owner: `0x${string}` | undefined }) {
  const parlays = useParlays(owner);
  if (!owner) return null;
  if (!("value" in parlays)) return null;
  const list = parlays.value.parlays;
  return (
    <section aria-label="Your parlays" className="flex flex-col gap-2">
      <h2 className="font-semibold text-section-title">Your parlays</h2>
      {list.length === 0 ? (
        <p className="text-body text-text-2">Your parlays show here once placed.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {list.map((p) => {
            const hero = parlayHero(p);
            return (
              <li key={String(p.parlayId)} className="flex flex-col gap-2 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className={cn("tnum font-semibold text-row-title", TONE[hero.tone])}>{hero.text}</span>
                  <span className="text-meta text-text-3">
                    {parlayStatus(p)} · {usd(p.stake)}
                  </span>
                </div>
                <ul className="flex flex-col gap-1">
                  {p.legs.map((l) => (
                    <li key={l.windowId} className="flex items-center gap-2 text-meta">
                      <EntityMark id={marketId(l.symbol)} size={MARK} decorative />
                      <span className="flex-1">{pickLine(l)}</span>
                      <span
                        className={cn("font-semibold", LEG_TONE[l.outcome as keyof typeof LEG_TONE] ?? "text-text-3")}
                      >
                        {LEG_WORD[l.outcome]}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
