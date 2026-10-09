"use client";
/**
 * Your duels (S8.6; Owarine's History and Rank): the rating with your record, then each finished duel as a row — who
 * it was against, the outcome and both totals — newest first; rows, not boxes.
 */
import type { DuelRatingView, DuelView } from "@senryo/api-client";
import { DUEL_LIVE_STATES, opponentOf, outcomeText, tierTitle } from "@senryo/calls";
import { type ChainId, duelTierOf } from "@senryo/config";
import { shortAddress } from "@senryo/core";

export function DuelHistory(p: {
  chainId: ChainId;
  owner: string | undefined;
  duels: readonly DuelView[];
  rating: DuelRatingView | null;
}) {
  const done = p.duels.filter((d) => !DUEL_LIVE_STATES.has(d.state));
  return (
    <section aria-label="Your duels" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold text-section-title">Your duels</h2>
        <span className="tnum text-meta text-text-2">
          {p.rating
            ? `Rating ${p.rating.rating} · ${p.rating.wins}–${p.rating.losses}${p.rating.ties ? `–${p.rating.ties}` : ""}`
            : "Rating 1000 · no duels yet"}
        </span>
      </div>
      {done.length === 0 ? (
        <p className="text-body text-text-2">Finished duels show here.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {done.map((d) => {
            const o = outcomeText(d, p.owner);
            const them = opponentOf(d, p.owner);
            const tier = duelTierOf(p.chainId, d.tier);
            return (
              <li key={d.matchId} className="flex items-baseline justify-between gap-3 py-3">
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold text-row-title">{o.title}</span>
                  <span className="truncate text-meta text-text-3">
                    vs {them ? shortAddress(them) : "—"}
                    {tier ? ` · ${tierTitle(tier)}` : ""}
                  </span>
                </span>
                <span className="tnum text-meta text-text-2">{o.detail}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
