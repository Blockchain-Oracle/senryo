import { createHmac, randomBytes } from "node:crypto";
import { type Hex, seriesIdOf, windowIdOf } from "@senryo/chain";
import { CALENDARS, type CadenceSec, type ChainId, DUEL, feedIdOf, marketsOn } from "@senryo/config";
import { scheduleOf, sessionCovers } from "@senryo/core";
import type { DuelCardRef } from "@senryo/service-common";
import { DECK_CADENCES, DECK_MARGIN_SEC, DECK_PRICE_FRESH_SEC, SEED_BYTES } from "./constants.ts";

/**
 * The deckmaster (D-294): three cards, each the running window of a different market, with room to play past the
 * pick deadline (the arena checks `minCardLifeSec` again at the reveal; the margin covers the open and reveal
 * transactions). Short windows first: 5-minute ones while they have the room, 15-minute ones to fill the deck. The
 * draw is HMAC-SHA256 keyed by the server's seed over both players' seeds and the card's index, so neither the server
 * alone nor a player alone chose it; the commitment over all three seeds and the cards is sealed on chain before the
 * reveal.
 */
export interface DeckSource {
  /** The newest price the gateway has for a feed (a stale or missing one leaves the market out). */
  latestE8(feedId: Hex): { publishTime: number } | undefined;
}

/** Every window a card could be right now, grouped by cadence in `DECK_CADENCES` order. */
export function candidates(chainId: ChainId, nowSec: number, prices: DeckSource): DuelCardRef[][] {
  const need = DUEL.minCardLifeSec + DECK_MARGIN_SEC;
  return DECK_CADENCES.map((cadenceSec: CadenceSec) =>
    marketsOn(chainId).flatMap((m): DuelCardRef[] => {
      if (!m.cadences.includes(cadenceSec)) return [];
      const start = nowSec - (nowSec % cadenceSec);
      const expiry = start + cadenceSec;
      if (expiry - nowSec < need) return [];
      if (!sessionCovers(scheduleOf(CALENDARS[m.calendarId].schedule), start, expiry)) return [];
      const latest = prices.latestE8(feedIdOf(m));
      if (!latest || nowSec - latest.publishTime > DECK_PRICE_FRESH_SEC) return [];
      const seriesId = seriesIdOf(m.symbol, cadenceSec);
      return [{ windowId: windowIdOf(seriesId, start), seriesId, symbol: m.symbol, cadenceSec, start, expiry }];
    }),
  );
}

const HEX = "hex";
const bytesOf = (h: Hex): Buffer => Buffer.from(h.slice(2), HEX);

export const freshSeed = (): Hex => `0x${randomBytes(SEED_BYTES).toString(HEX)}`;

/** Index `i` of the draw: HMAC(serverSeed; seedA ‖ seedB ‖ i) as a number below `n`. */
function drawIndex(serverSeed: Hex, seeds: readonly [Hex, Hex], i: number, n: number): number {
  const mac = createHmac("sha256", bytesOf(serverSeed))
    .update(Buffer.concat([bytesOf(seeds[0]), bytesOf(seeds[1]), Buffer.from([i])]))
    .digest(HEX);
  return Number(BigInt(`0x${mac}`) % BigInt(n));
}

/** Three cards on three markets, or undefined when the clock leaves too few (the queue waits for the next window). */
export function drawDeck(
  pools: DuelCardRef[][],
  serverSeed: Hex,
  seeds: readonly [Hex, Hex],
): [DuelCardRef, DuelCardRef, DuelCardRef] | undefined {
  const deck: DuelCardRef[] = [];
  let draw = 0;
  for (const pool of pools) {
    const left = pool.filter((c) => !deck.some((d) => d.symbol === c.symbol));
    while (deck.length < DUEL.cards && left.length > 0) {
      const [card] = left.splice(drawIndex(serverSeed, seeds, draw++, left.length), 1);
      if (card && !deck.some((d) => d.symbol === card.symbol)) deck.push(card);
    }
    if (deck.length === DUEL.cards) return deck as [DuelCardRef, DuelCardRef, DuelCardRef];
  }
  return undefined;
}
