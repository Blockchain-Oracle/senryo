"use client";
/**
 * Finding an opponent (R7.8, research 10 §4; Owarine's DuelQueue): your portrait at the centre of a breathing search —
 * rings that pulse out every 2.4 s — with the stake, how long you've waited, and a way out. Quiet: the match chord and
 * a firm haptic arrive when someone takes the other seat (`useDuelMoments`).
 */
import { type duelTiers, tierTitle } from "@senryo/calls";
import { clockText } from "@senryo/core";
import { useServerSeconds } from "@senryo/live/react";
import { Avatar } from "@/components/identity/avatar";
import "./duel.css";

const MS_PER_SECOND = 1000;
const PORTRAIT = 72;
const RINGS = 3;
/** One breath of the search (research 10 §4); the rings share it evenly. */
const BREATH_SEC = 2.4;

export function DuelQueue(p: {
  tier: ReturnType<typeof duelTiers>[number] | undefined;
  since: string;
  owner: string | undefined;
  avatar: string | null;
  onCancel: () => void;
}) {
  const now = useServerSeconds();
  const waited = Math.max(0, now - Math.floor(Date.parse(p.since) / MS_PER_SECOND));
  return (
    <section aria-label="Finding an opponent" className="duel-queue" aria-live="polite">
      <div className="duel-radar" aria-hidden>
        {Array.from({ length: RINGS }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed rings
          <span key={i} className="duel-ring" style={{ animationDelay: `${(i * BREATH_SEC) / RINGS}s` }} />
        ))}
        <span className="duel-radar-me">
          <Avatar avatar={p.avatar} {...(p.owner ? { address: p.owner } : {})} size={PORTRAIT} />
        </span>
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <h2 className="font-semibold text-section-title">Finding an opponent…</h2>
        <span className="tnum text-meta text-text-2">
          {p.tier ? tierTitle(p.tier) : "Duel"} · waiting {clockText(waited)}
        </span>
      </div>
      <button
        type="button"
        onClick={p.onCancel}
        className="press-lift h-12 w-full rounded-xl bg-secondary font-semibold text-button focus-visible:outline-2 focus-visible:outline-ring"
      >
        Leave the queue
      </button>
    </section>
  );
}
