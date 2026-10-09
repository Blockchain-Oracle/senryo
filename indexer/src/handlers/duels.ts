import { type Duel, type DuelRating, type EvmOnEventContext, indexer } from "envio";
import { key } from "../lib/records.ts";

/**
 * Duels (contracts/src/games/DuelArena.sol, D-294): the match from opening to its pot, each player's call per card, and
 * the players' ratings. A pick's reserve ticket is the arena's on chain; its `PickPlaced` comes in the same transaction
 * as the ticket's `Committed` and before any fill, so the ticket is handed to the player here — a duel card counts on
 * the player's record like any call of theirs.
 */
type Ctx = EvmOnEventContext;

const STATES = ["none", "sealed", "picking", "settling", "forfeited", "refunded", "finalized"];
const ZERO = "0x0000000000000000000000000000000000000000";
/** Elo (Owarine's ladder): from 1000; K 48 for a player's first 10 duels, then 24. */
const START_RATING = 1000;
const K_NEW = 48;
const K_SETTLED = 24;
const NEW_DUELS = 10;
const ELO_SCALE = 400;
const ELO_BASE = 10;
const TIE_SCORE = 0.5;

const pickId = (chainId: number, matchId: string, card: number, player: string) =>
  `${key(chainId, matchId)}_${card}_${player.toLowerCase()}`;

async function duelOf(context: Ctx, chainId: number, matchId: string): Promise<Duel | undefined> {
  return context.Duel.get(key(chainId, matchId));
}

function newRating(chainId: number, owner: string): DuelRating {
  return {
    id: key(chainId, owner),
    chainId,
    owner,
    rating: START_RATING,
    played: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    updatedAt: 0,
  };
}

/** Moves both ratings by one decided duel (score 1 win, 0 loss, ½ tie) and returns the changes. */
async function rate(context: Ctx, d: Duel, scoreA: number, at: number): Promise<[number, number]> {
  const a = (await context.DuelRating.get(key(d.chainId, d.playerA))) ?? newRating(d.chainId, d.playerA);
  const b = (await context.DuelRating.get(key(d.chainId, d.playerB))) ?? newRating(d.chainId, d.playerB);
  const expectedA = 1 / (1 + ELO_BASE ** ((b.rating - a.rating) / ELO_SCALE));
  const kOf = (r: DuelRating) => (r.played < NEW_DUELS ? K_NEW : K_SETTLED);
  const deltaA = Math.round(kOf(a) * (scoreA - expectedA));
  const deltaB = Math.round(kOf(b) * (1 - scoreA - (1 - expectedA)));
  const tally = (r: DuelRating, score: number, delta: number): DuelRating => ({
    ...r,
    rating: r.rating + delta,
    played: r.played + 1,
    wins: r.wins + (score === 1 ? 1 : 0),
    losses: r.losses + (score === 0 ? 1 : 0),
    ties: r.ties + (score === TIE_SCORE ? 1 : 0),
    updatedAt: at,
  });
  context.DuelRating.set(tally(a, scoreA, deltaA));
  context.DuelRating.set(tally(b, 1 - scoreA, deltaB));
  return [deltaA, deltaB];
}

indexer.onEvent({ contract: "DuelArena", event: "MatchOpened" }, async ({ event, context }) => {
  const p = event.params;
  context.Duel.set({
    id: key(event.chainId, p.matchId),
    chainId: event.chainId,
    matchId: p.matchId,
    tier: Number(p.tier),
    playerA: p.playerA,
    playerB: p.playerB,
    pot: p.pot,
    cardStake: p.cardStake,
    state: "sealed",
    deckHash: p.deckHash,
    cards: [],
    serverSeed: undefined,
    pickDeadline: undefined,
    forfeitedBy: undefined,
    winner: undefined,
    resultA: 0n,
    resultB: 0n,
    ratingDeltaA: undefined,
    ratingDeltaB: undefined,
    openedAt: event.block.timestamp,
    openTx: event.transaction.hash,
    revealTx: undefined,
    finishedAt: undefined,
    finishTx: undefined,
  });
});

indexer.onEvent({ contract: "DuelArena", event: "DeckRevealed" }, async ({ event, context }) => {
  const p = event.params;
  const d = await duelOf(context, event.chainId, p.matchId);
  if (!d) return;
  context.Duel.set({
    ...d,
    state: "picking",
    cards: [...p.cards],
    serverSeed: p.serverSeed,
    pickDeadline: Number(p.pickDeadline),
    revealTx: event.transaction.hash,
  });
});

indexer.onEvent({ contract: "DuelArena", event: "PickPlaced" }, async ({ event, context }) => {
  const p = event.params;
  const card = Number(p.card);
  context.DuelPick.set({
    id: pickId(event.chainId, p.matchId, card, p.player),
    chainId: event.chainId,
    matchId: p.matchId,
    player: p.player,
    card,
    band: Number(p.band),
    ticketId: p.ticketId,
    returned: undefined,
    result: undefined,
    pickedAt: event.block.timestamp,
    pickTx: event.transaction.hash,
  });
  const t = await context.Ticket.get(key(event.chainId, p.ticketId));
  if (t) context.Ticket.set({ ...t, owner: p.player, duelMatch: p.matchId });
});

indexer.onEvent({ contract: "DuelArena", event: "PicksLocked" }, async ({ event, context }) => {
  const p = event.params;
  const d = await duelOf(context, event.chainId, p.matchId);
  if (!d) return;
  const forfeitedBy = p.forfeitedBy === ZERO ? undefined : p.forfeitedBy;
  context.Duel.set({ ...d, state: STATES[Number(p.status)] ?? d.state, forfeitedBy });
});

indexer.onEvent({ contract: "DuelArena", event: "CardSettled" }, async ({ event, context }) => {
  const p = event.params;
  const id = pickId(event.chainId, p.matchId, Number(p.card), p.player);
  const pick = await context.DuelPick.get(id);
  if (pick) context.DuelPick.set({ ...pick, returned: p.returned, result: p.result });
});

indexer.onEvent({ contract: "DuelArena", event: "MatchFinalized" }, async ({ event, context }) => {
  const p = event.params;
  const d = await duelOf(context, event.chainId, p.matchId);
  if (!d) return;
  const winner = p.winner === ZERO ? undefined : p.winner;
  const scoreA = !winner ? TIE_SCORE : winner.toLowerCase() === d.playerA.toLowerCase() ? 1 : 0;
  const [deltaA, deltaB] = await rate(context, d, scoreA, event.block.timestamp);
  context.Duel.set({
    ...d,
    state: "finalized",
    winner,
    resultA: p.resultA,
    resultB: p.resultB,
    ratingDeltaA: deltaA,
    ratingDeltaB: deltaB,
    finishedAt: event.block.timestamp,
    finishTx: event.transaction.hash,
  });
});

indexer.onEvent({ contract: "DuelArena", event: "MatchRefunded" }, async ({ event, context }) => {
  const d = await duelOf(context, event.chainId, event.params.matchId);
  if (!d) return;
  context.Duel.set({ ...d, state: "refunded", finishedAt: event.block.timestamp, finishTx: event.transaction.hash });
});
