/**
 * Warm-up, both apps (S8.8, D-295; Owarine's Practice game): five live windows dealt as cards, a swipe Up or Down on
 * each at the live price, a 30-second watch on the live feed, then every card scored at one instant against a
 * coin-flip bot. No stake, no account, nothing on chain — and the stage says so.
 */

import {
  nextWarmUpCard,
  selectWarmUpDeck,
  WARM_UP_IDLE,
  type WarmUpCandidate,
  type WarmUpRound,
  type WarmUpSide,
  warmUpScore,
  warmUpTransition,
} from "@senryo/core";
import { useLive, useServerSeconds } from "@senryo/live/react";
import { useCatalog } from "@senryo/query";
import { useCallback, useEffect, useReducer } from "react";

/** A market's price is live when it ticked within this (stale feeds aren't dealt). */
const FRESH_MS = 15_000;
const SEED_BYTES = 8;
const HEX = 16;
const BYTE_HEX = 2;
const MS_PER_SEC = 1_000;

function freshRoundSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SEED_BYTES));
  return Array.from(bytes, (b) => b.toString(HEX).padStart(BYTE_HEX, "0")).join("");
}

export function useWarmUp() {
  const live = useLive();
  const now = useServerSeconds();
  const catalog = useCatalog();
  const [round, dispatch] = useReducer(warmUpTransition, WARM_UP_IDLE);

  const deal = useCallback(() => {
    if (!("value" in catalog)) return;
    const nowMs = live.clock.nowSec() * MS_PER_SEC;
    const at = live.clock.nowSec();
    const candidates: WarmUpCandidate[] = catalog.value.markets.flatMap((m) => {
      const tick = live.prices.latest(m.symbol);
      const trading = tick !== undefined && nowMs - tick.publishMs < FRESH_MS;
      return m.series.map((s) => ({
        symbol: m.symbol,
        cadenceSec: s.cadenceSec,
        expirySec: at - (at % s.cadenceSec) + s.cadenceSec,
        trading,
      }));
    });
    dispatch({ kind: "deal", seed: freshRoundSeed(), cards: selectWarmUpDeck(candidates, at) });
  }, [catalog, live]);

  /** One swipe on the next card at the live price. */
  const swipe = useCallback(
    (side: WarmUpSide) => {
      const card = nextWarmUpCard(round);
      const tick = card && live.prices.latest(card.symbol);
      if (!card || !tick) return;
      dispatch({
        kind: "pick",
        pick: { cardIndex: card.index, side, entryE8: tick.priceE8, atMs: live.clock.nowSec() * MS_PER_SEC },
      });
    },
    [round, live],
  );

  // The watch ends: every card read at the same instant.
  useEffect(() => {
    if (round.phase !== "watching" || round.watchEndsAtMs === null) return;
    if (now * MS_PER_SEC < round.watchEndsAtMs) return;
    dispatch({
      kind: "score",
      closes: round.cards.map((c) => ({ cardIndex: c.index, closeE8: live.prices.latest(c.symbol)?.priceE8 ?? 0 })),
    });
  }, [round, now, live]);

  const watchLeft =
    round.phase === "watching" && round.watchEndsAtMs !== null
      ? Math.max(0, Math.ceil(round.watchEndsAtMs / MS_PER_SEC - now))
      : null;

  return {
    round: round as WarmUpRound,
    next: nextWarmUpCard(round),
    score: round.phase === "scored" ? warmUpScore(round) : null,
    watchLeft,
    ready: "value" in catalog,
    deal,
    swipe,
    /** The live price of a card's market (× 1e8), for the stage's moving numbers. */
    priceOf: (symbol: string) => live.prices.latest(symbol)?.priceE8 ?? null,
  };
}

export type WarmUpFlow = ReturnType<typeof useWarmUp>;
