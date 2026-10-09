/**
 * Duel (D-294, `contracts/src/games/DuelTypes.sol`): two seats, a sealed deck of three windows, one Up or Down call per
 * card each; the better total takes both pots. The clocks are the arena's immutables; tiers are set at deploy.
 */
import { type ChainId, MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "./networks.ts";

const USD = 1_000_000n;

export const DUEL = {
  cards: 3,
  seats: 2,
  /** The deck must be revealed within this of the match opening, or both seats are refunded. */
  revealWindowSec: 120,
  /** Both seats pick every card within this of the reveal; a seat short forfeits the pot. */
  pickWindowSec: 120,
  /** Every card must still run this long at the reveal (more than the pick window plus the 20 s lockout). */
  minCardLifeSec: 180,
  /** A signed entry stays good this long in the queue. */
  entryTtlSec: 300,
} as const;

/** One entry price: each seat's pot (the winner takes both) and the stake of every card's call. */
export interface DuelTierSpec {
  id: number;
  pot: bigint;
  cardStake: bigint;
}

/** Tier ids are the arena's; a tier with no pot is a free duel whose cards are still real calls. */
export const DUEL_TIERS: Readonly<Record<ChainId, readonly DuelTierSpec[]>> = {
  [TESTNET_CHAIN_ID]: [
    { id: 0, pot: 0n, cardStake: 10n * USD },
    { id: 1, pot: 10n * USD, cardStake: 10n * USD },
    { id: 2, pot: 50n * USD, cardStake: 25n * USD },
    { id: 3, pot: 100n * USD, cardStake: 50n * USD },
  ],
  [MAINNET_CHAIN_ID]: [
    { id: 0, pot: 0n, cardStake: 1n * USD },
    { id: 1, pot: 5n * USD, cardStake: 2n * USD },
    { id: 2, pot: 10n * USD, cardStake: 5n * USD },
  ],
};

export function duelTierOf(chainId: ChainId, id: number): DuelTierSpec | undefined {
  return DUEL_TIERS[chainId].find((t) => t.id === id);
}

/** What one entry escrows: the pot and every card's stake. */
export const duelEntryCost = (t: DuelTierSpec): bigint => t.pot + t.cardStake * BigInt(DUEL.cards);
