"use client";
import { useWarmUp } from "@senryo/calls/react";
import type { WarmUpCard, WarmUpResult } from "@senryo/core";
/**
 * Warm-up (S8.8, D-295; Owarine's Practice game; `/app/games/warm-up/`): five live windows as cards in the duel's swipe
 * deck (21st Swipe Deck #23568) — swipe or ← Down / Up → at the live price — then a 30-second watch on the live feed,
 * and every card scored at one instant against a coin flip. No stake, no account, nothing on chain.
 */
import { lane } from "@senryo/core";
import { SwipeDeck } from "@/components/ui/swipe-deck";
import { fire } from "@/lib/feedback";
import { cn } from "@/lib/utils";

const E8 = 1e8;
const PRICE_DIGITS = 2;
const priceText = (e8: number | null) =>
  e8 === null ? "—" : (e8 / E8).toLocaleString(undefined, { maximumFractionDigits: PRICE_DIGITS });
const RESULT_WORD: Record<WarmUpResult, string> = { won: "Right", lost: "Wrong", flat: "Flat" };

export function WarmUpScreen() {
  const w = useWarmUp();
  const r = w.round;
  const dealt = r.cards.length > 0;
  const index = r.picks.length;
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <p className="text-body text-text-2">Five live cards · Up or Down · against a coin flip · no stakes</p>

      {!dealt || r.phase === "scored" ? (
        <button
          type="button"
          disabled={!w.ready}
          onClick={() => {
            fire("tick", { cue: "tap" });
            w.deal();
          }}
          className="h-14 rounded-xl bg-primary font-semibold text-button text-primary-foreground transition-transform active:scale-97 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
        >
          {r.phase === "scored" ? "Deal again" : "Deal the cards"}
        </button>
      ) : null}

      {dealt && (r.phase === "dealt" || r.phase === "picking") ? (
        <SwipeDeck<WarmUpCard>
          items={r.cards}
          index={index}
          itemKey={(c) => `${c.symbol}:${c.cadenceSec}`}
          itemLabel={(c) => `${c.symbol} ${lane(c.cadenceSec)}`}
          onDecide={(_, side) => {
            fire("tick", { cue: "tap" });
            w.swipe(side === "right" ? "up" : "down");
          }}
          leftLabel="Down"
          rightLabel="Up"
          emptyLabel="Watching…"
        >
          {(c) => (
            <div className="flex flex-col items-center gap-2 py-8">
              <span className="text-meta text-text-3">
                Card {c.index + 1} of {r.cards.length} · {lane(c.cadenceSec)}
              </span>
              <span className="font-semibold text-page-title">{c.symbol}</span>
              <span className="tnum text-section-title text-text-2">{priceText(w.priceOf(c.symbol))}</span>
              <span className="text-meta text-text-3">Up or down in the next 30 seconds after the last card?</span>
            </div>
          )}
        </SwipeDeck>
      ) : null}

      {r.phase === "watching" ? (
        <p className="tnum text-body text-text-2" role="status" aria-live="polite">
          Watching the live price · scores in {w.watchLeft ?? 0}s
        </p>
      ) : null}

      {w.score ? (
        <section aria-label="Result" className="flex flex-col gap-3">
          <h2 className="font-semibold text-section-title">
            {w.score.winner === "you" ? "You beat the coin" : w.score.winner === "bot" ? "The coin won" : "A tie"} ·{" "}
            {w.score.youWon}–{w.score.botWon}
          </h2>
          <ul className="flex flex-col divide-y divide-border">
            {w.score.cards.map((c) => (
              <li key={c.card.index} className="flex items-baseline justify-between gap-3 py-2">
                <span className="text-row-title">
                  {c.card.symbol} · you {c.side === "up" ? "Up" : "Down"} · coin {c.botSide === "up" ? "Up" : "Down"}
                </span>
                <span
                  className={cn(
                    "tnum text-meta",
                    c.you === "won" ? "text-up" : c.you === "lost" ? "text-down" : "text-text-3",
                  )}
                >
                  {RESULT_WORD[c.you]} · {priceText(c.entryE8)} → {priceText(c.closeE8)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-meta text-text-3">Scored on the live price, not a window's close · nothing was staked</p>
        </section>
      ) : null}
    </div>
  );
}
