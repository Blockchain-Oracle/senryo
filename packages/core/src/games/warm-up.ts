/**
 * Warm-up (S8.8, D-295; Owarine packages/core/src/games/practice.ts — renamed, since Practice is Senryo's test-dollar
 * mode): a deck of live windows to learn the motion on, a coin-flip opponent, and the rule that scores a card without
 * money, a chain or an invented number. A card asks its window's question; Warm-up answers it on the live price over a
 * short watch (every reading is a real feed reading) and never claims a settlement, a payout or a real opponent. Every
 * card is scored at one instant when the watch ends, so the deck's order never becomes part of the result.
 */

export type WarmUpSide = "up" | "down";

/** The watch after the last swipe, and the room for the swipes themselves. */
export const WARM_UP_WATCH_SEC = 30;
export const WARM_UP_SWIPE_BUDGET_SEC = 90;
/** A card must outlast the swipes and the watch, so none counts down to zero under the player's hand. */
export const WARM_UP_CARD_MIN_LIFE_SEC = WARM_UP_SWIPE_BUDGET_SEC + WARM_UP_WATCH_SEC;
export const WARM_UP_DECK_MAX = 5;
const MS_PER_SEC = 1_000;

/** A card: a live window by its market and cadence. */
export interface WarmUpCard {
  index: number;
  symbol: string;
  cadenceSec: number;
  expirySec: number;
}

export interface WarmUpCandidate {
  symbol: string;
  cadenceSec: number;
  expirySec: number;
  trading: boolean;
}

/** One swipe: the side and the live reading (× 1e8) at the moment it was made. */
export interface WarmUpPick {
  cardIndex: number;
  side: WarmUpSide;
  entryE8: number;
  atMs: number;
}

export interface WarmUpClose {
  cardIndex: number;
  closeE8: number;
}

export type WarmUpMove = "up" | "down" | "flat";
export type WarmUpResult = "won" | "lost" | "flat";
export type WarmUpPhase = "dealt" | "picking" | "watching" | "scored";

export interface WarmUpRound {
  phase: WarmUpPhase;
  /** The bot's whole hand is a function of this and the card index. */
  seed: string;
  cards: readonly WarmUpCard[];
  picks: readonly WarmUpPick[];
  watchEndsAtMs: number | null;
  closes: readonly WarmUpClose[];
}

export type WarmUpEvent =
  | { kind: "deal"; seed: string; cards: readonly WarmUpCard[] }
  | { kind: "pick"; pick: WarmUpPick }
  | { kind: "score"; closes: readonly WarmUpClose[] };

export const WARM_UP_IDLE: WarmUpRound = {
  phase: "dealt",
  seed: "",
  cards: [],
  picks: [],
  watchEndsAtMs: null,
  closes: [],
};

/** FNV-1a's 32-bit offset basis and prime; then an avalanche so the top bit is a fair coin. */
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const MIX_A = 15;
const MIX_MUL = 0x2545f491;
const MIX_B = 13;
const TOP_BIT = 31;

/**
 * The opponent, and the whole of it: FNV-1a over the seed and the card index, avalanched, then the top bit. A coin flip,
 * and the stage says so. (FNV-1a's low bit is unusable — multiplying by an odd prime preserves it — hence the
 * avalanche and the top bit.)
 */
export function warmUpBotSide(seed: string, cardIndex: number): WarmUpSide {
  const input = `${seed}:${cardIndex}`;
  let hash = FNV_OFFSET;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  hash ^= hash >>> MIX_A;
  hash = Math.imul(hash, MIX_MUL) >>> 0;
  hash ^= hash >>> MIX_B;
  return hash >>> TOP_BIT === 0 ? "up" : "down";
}

export function warmUpMove(entryE8: number, closeE8: number): WarmUpMove {
  if (closeE8 > entryE8) return "up";
  if (closeE8 < entryE8) return "down";
  return "flat";
}

/** A flat price is nobody's win: two players on opposite sides both lose it. */
export function warmUpResult(side: WarmUpSide, entryE8: number, closeE8: number): WarmUpResult {
  const move = warmUpMove(entryE8, closeE8);
  if (move === "flat") return "flat";
  return move === side ? "won" : "lost";
}

/** The deck: trading now and still trading when the round ends, soonest close first, one card per market. */
export function selectWarmUpDeck(
  candidates: readonly WarmUpCandidate[],
  nowSec: number,
  size = WARM_UP_DECK_MAX,
): readonly WarmUpCard[] {
  const seen = new Set<string>();
  const firstPerMarket = (c: WarmUpCandidate) => {
    if (seen.has(c.symbol)) return false;
    seen.add(c.symbol);
    return true;
  };
  return candidates
    .filter((c) => c.trading && c.expirySec - nowSec > WARM_UP_CARD_MIN_LIFE_SEC)
    .sort((a, b) => a.expirySec - b.expirySec || a.symbol.localeCompare(b.symbol))
    .filter(firstPerMarket)
    .slice(0, Math.max(0, Math.min(size, WARM_UP_DECK_MAX)))
    .map((c, index) => ({ index, symbol: c.symbol, cadenceSec: c.cadenceSec, expirySec: c.expirySec }));
}

export function nextWarmUpCard(round: WarmUpRound): WarmUpCard | null {
  const picked = new Set(round.picks.map((p) => p.cardIndex));
  return round.cards.find((card) => !picked.has(card.index)) ?? null;
}

/** The reducer, total: a replayed event (a re-render, a double gesture) is a no-op, never a second entry. */
export function warmUpTransition(round: WarmUpRound, event: WarmUpEvent): WarmUpRound {
  if (event.kind === "deal") {
    return { phase: "dealt", seed: event.seed, cards: event.cards, picks: [], watchEndsAtMs: null, closes: [] };
  }
  if (event.kind === "pick") {
    if (round.phase !== "dealt" && round.phase !== "picking") return round;
    if (!round.cards.some((card) => card.index === event.pick.cardIndex)) return round;
    if (round.picks.some((p) => p.cardIndex === event.pick.cardIndex)) return round;
    const picks = [...round.picks, event.pick];
    if (picks.length < round.cards.length) return { ...round, phase: "picking", picks };
    return { ...round, phase: "watching", picks, watchEndsAtMs: event.pick.atMs + WARM_UP_WATCH_SEC * MS_PER_SEC };
  }
  if (round.phase !== "watching") return round;
  return { ...round, phase: "scored", closes: event.closes };
}

export interface WarmUpCardScore {
  card: WarmUpCard;
  side: WarmUpSide;
  botSide: WarmUpSide;
  entryE8: number;
  closeE8: number;
  move: WarmUpMove;
  you: WarmUpResult;
  bot: WarmUpResult;
}

export interface WarmUpScore {
  cards: readonly WarmUpCardScore[];
  youWon: number;
  botWon: number;
  /** null on a tie, including the tie where a flat price gave neither side anything. */
  winner: "you" | "bot" | null;
}

/** The scoreboard, derived from the readings the round holds. */
export function warmUpScore(round: WarmUpRound): WarmUpScore {
  const closeOf = new Map(round.closes.map((c) => [c.cardIndex, c.closeE8]));
  const cards: WarmUpCardScore[] = [];
  for (const pick of round.picks) {
    const card = round.cards.find((c) => c.index === pick.cardIndex);
    const closeE8 = closeOf.get(pick.cardIndex);
    if (!card || closeE8 === undefined) continue;
    const botSide = warmUpBotSide(round.seed, pick.cardIndex);
    cards.push({
      card,
      side: pick.side,
      botSide,
      entryE8: pick.entryE8,
      closeE8,
      move: warmUpMove(pick.entryE8, closeE8),
      you: warmUpResult(pick.side, pick.entryE8, closeE8),
      bot: warmUpResult(botSide, pick.entryE8, closeE8),
    });
  }
  cards.sort((a, b) => a.card.index - b.card.index);
  const youWon = cards.filter((c) => c.you === "won").length;
  const botWon = cards.filter((c) => c.bot === "won").length;
  return { cards, youWon, botWon, winner: youWon === botWon ? null : youWon > botWon ? "you" : "bot" };
}
