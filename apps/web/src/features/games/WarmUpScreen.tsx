"use client";
/**
 * Warm-up, beat the coin (S8.8, D-295; R7.5; Owarine's Practice game): five big live cards dealt with their sound, each
 * swiped Up or Down at the live price (the coin's own pick flips in beside yours), then a 30-second watch where the
 * five races run live — the move since your pick and who leads it — and a reveal, card by card 220 ms apart with each
 * verdict's sound, then the score and a fanfare. No stake, no account, nothing on chain.
 */
import { useWarmUp, type WarmUpFlow } from "@senryo/calls/react";
import { WARM_UP_DECK_MAX, type WarmUpCard, type WarmUpResult } from "@senryo/core";
import { useServerSeconds } from "@senryo/live/react";
import { useEffect, useRef, useState } from "react";
import { SwipeDeck } from "@/components/ui/swipe-deck";
import { fire, music, sound } from "@/lib/feedback";
import { celebrate } from "@/lib/feedback/celebrate";
import { CountdownRing } from "../terminal/CountdownRing";
import { RaceRow, Slots, WarmCard } from "./WarmUpParts";
import "./games.css";
import { useCatalogRetry } from "@/lib/use-catalog-retry";

const REVEAL_MS = 220;
const DEAL_GAP_MS = 90;
const BEEP_FROM_SEC = 5;
const WATCH_SEC = 30;
const MS = 1000;

/** The reveal: one card a beat, each with its verdict, then the score's fanfare. */
function useReveal(w: WarmUpFlow): number {
  const [shown, setShown] = useState(0);
  const flow = useRef(w);
  flow.current = w;
  const scored = w.round.phase === "scored";
  const total = w.round.cards.length;
  useEffect(() => {
    if (!scored) {
      setShown(0);
      return;
    }
    const score = flow.current.score;
    if (!score || shown > total) return;
    const t = window.setTimeout(() => {
      const c = score.cards[shown];
      if (c) fire(c.you === "won" ? "snap" : "tick", c.you === "won" ? { ladder: ["gap", shown] } : { cue: "adverse" });
      else if (score.winner === "you") {
        fire("win", { cue: "jackpot" });
        celebrate();
      } else fire(score.winner === "bot" ? "loss" : "tick", { cue: score.winner === "bot" ? "loss" : "refund" });
      setShown((n) => n + 1);
    }, REVEAL_MS);
    return () => window.clearTimeout(t);
  }, [scored, shown, total]);
  return shown;
}

export function WarmUpScreen() {
  const markets = useCatalogRetry();
  const w = useWarmUp();
  const r = w.round;
  const now = useServerSeconds();
  const dealt = r.cards.length > 0;
  const shown = useReveal(w);
  const score = r.phase === "scored" ? w.score : null;
  const results: (WarmUpResult | null)[] = r.cards.map((_, i) =>
    score && i < shown ? (score.cards[i]?.you ?? null) : null,
  );

  useEffect(() => () => music(null), []);
  // The last seconds of the watch count down out loud.
  useEffect(() => {
    if (r.phase === "watching" && w.watchLeft !== null && w.watchLeft > 0 && w.watchLeft <= BEEP_FROM_SEC)
      sound("countBeep");
  }, [r.phase, w.watchLeft]);

  const deal = () => {
    fire("press", { cue: "tap" });
    music("games");
    w.deal();
    for (let i = 0; i < WARM_UP_DECK_MAX; i++) window.setTimeout(() => sound("cardDeal"), i * DEAL_GAP_MS);
  };

  const ends = r.watchEndsAtMs === null ? null : r.watchEndsAtMs / MS;
  const finished = score !== null && shown > r.cards.length;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      {dealt ? <Slots cards={r.cards} picks={r.picks} coinOf={w.coinOf} results={results} /> : null}

      {!dealt || finished ? (
        <section className="warm-table flex flex-col items-center gap-4 rounded-3xl p-6 text-center">
          {finished && score ? (
            <>
              <span className="warm-stamp font-semibold text-page-title">
                {score.winner === "you" ? "You beat the coin" : score.winner === "bot" ? "The coin won" : "A tie"}
              </span>
              <span className="tnum font-semibold text-display-price">
                {score.youWon}–{score.botWon}
              </span>
            </>
          ) : (
            <>
              <span className="font-semibold text-page-title">Beat the coin</span>
              <span className="text-body text-text-2">
                Five live cards. Call each Up or Down; a coin calls them too. Thirty seconds later, the better caller
                wins. No stakes.
              </span>
            </>
          )}
          <button
            type="button"
            disabled={!w.ready && !markets.failed}
            onClick={!w.ready && markets.failed ? markets.retry : deal}
            className="press-lift h-14 rounded-xl border-b-4 border-up-fill-edge bg-up-fill px-8 font-semibold text-button text-on-direction-fill focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
          >
            {!w.ready
              ? markets.failed
                ? "Markets didn't load · Try again"
                : "Loading markets…"
              : finished
                ? "Deal again"
                : "Deal the cards"}
          </button>
        </section>
      ) : null}

      {dealt && (r.phase === "dealt" || r.phase === "picking") ? (
        <SwipeDeck<WarmUpCard>
          items={r.cards}
          index={r.picks.length}
          itemKey={(c) => `${c.symbol}:${c.cadenceSec}`}
          itemLabel={(c) => c.symbol}
          onDecide={(c, side) => {
            fire("tick", { cue: "cardSlam" });
            w.swipe(side === "right" ? "up" : "down");
            window.setTimeout(() => sound("cardFlip"), REVEAL_MS);
            if (c.index === r.cards.length - 1) sound("eventLock");
          }}
          leftLabel="Down"
          rightLabel="Up"
          emptyLabel="Watching…"
          tall
        >
          {(c) => <WarmCard card={c} of={r.cards.length} />}
        </SwipeDeck>
      ) : null}

      {r.phase === "watching" || (r.phase === "scored" && !finished) ? (
        <section aria-label="The races" className="flex flex-col gap-2">
          {r.phase === "watching" && ends !== null ? (
            <div className="flex items-center gap-3" role="status" aria-live="polite">
              <CountdownRing fromSec={ends - WATCH_SEC} toSec={ends} nowSec={now} />
              <span className="text-body text-text-2">Watching the live price · scores in {w.watchLeft ?? 0}s</span>
            </div>
          ) : null}
          <RaceList w={w} shown={shown} />
        </section>
      ) : null}

      {finished && score ? <RaceList w={w} shown={shown} /> : null}
      <p className="text-meta text-text-3">Scored on the live price, not a window's close · nothing is staked</p>
    </div>
  );
}

function RaceList({ w, shown }: { w: WarmUpFlow; shown: number }) {
  const r = w.round;
  const score = r.phase === "scored" ? w.score : null;
  return (
    <ul className="flex flex-col divide-y divide-border">
      {r.picks.map((p) => {
        const card = r.cards[p.cardIndex];
        if (!card) return null;
        const scored = score && p.cardIndex < shown ? score.cards.find((c) => c.card.index === p.cardIndex) : undefined;
        return (
          <RaceRow
            key={p.cardIndex}
            card={card}
            side={p.side}
            coin={w.coinOf(p.cardIndex)}
            entryE8={p.entryE8}
            closeE8={scored ? scored.closeE8 : null}
            result={scored ? scored.you : null}
          />
        );
      })}
    </ul>
  );
}
