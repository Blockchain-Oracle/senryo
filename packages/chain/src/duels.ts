/**
 * Duel (S8.6, D-294) for the apps, the api and the keeper: the EIP-712 `DuelEntry` and `DuelPick` exactly as
 * `DuelArena` hashes them (domain "Senryo Duel" v1 on the arena), the match id and the sealed deck's commitment, the
 * calldata of every step (open, reveal with its windows, pick, lock, settle a card, finalize, refund), and the arena's
 * events as changes for the services' book.
 */

import type { ChainId } from "@senryo/config";
import { bandReserveAbi, duelArenaAbi } from "@senryo/contracts/abis";
import {
  type Address,
  bytesToHex,
  concat,
  decodeEventLog,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  type Hex,
  hashTypedData,
  keccak256,
  type Log,
  recoverTypedDataAddress,
} from "viem";
import type { ReadClient } from "./clients.ts";
import { addressOf, dollarTokenOf, NotDeployedError } from "./contracts.ts";
import { NO_PERMIT, type PermitArgs } from "./market-calls.ts";
import { aggregate, type Call } from "./markets.ts";
import { type LegWindow, openWindowCalls } from "./parlays.ts";

const SEED_BYTES = 32;

export const DUEL_DOMAIN_NAME = "Senryo Duel";
export const DUEL_DOMAIN_VERSION = "1";

export function duelDomain(chainId: ChainId) {
  return {
    name: DUEL_DOMAIN_NAME,
    version: DUEL_DOMAIN_VERSION,
    chainId,
    verifyingContract: addressOf(chainId, "DuelArena"),
  } as const;
}

export const DUEL_ENTRY_TYPES = {
  DuelEntry: [
    { name: "owner", type: "address" },
    { name: "tier", type: "uint8" },
    { name: "delegate", type: "address" },
    { name: "seed", type: "bytes32" },
    { name: "deadline", type: "uint64" },
    { name: "nonce", type: "uint256" },
    { name: "epoch", type: "uint32" },
  ],
} as const;

export const DUEL_PICK_TYPES = {
  DuelPick: [
    { name: "matchId", type: "bytes32" },
    { name: "player", type: "address" },
    { name: "card", type: "uint8" },
    { name: "band", type: "uint8" },
    { name: "minPayout", type: "uint64" },
  ],
} as const;

/** A seat in the queue: the tier, the device key that swipes this seat's picks, the player's half of the deck seed. */
export interface MarketDuelEntry {
  owner: Address;
  tier: number;
  delegate: Address;
  seed: Hex;
  deadline: bigint;
  nonce: bigint;
  epoch: number;
}

export interface MarketDuelPick {
  matchId: Hex;
  player: Address;
  card: number;
  band: number;
  minPayout: bigint;
}

export interface SignedDuelEntry {
  entry: MarketDuelEntry;
  signature: Hex;
  permit: PermitArgs | null;
}

/** The arena's match states, by their on-chain code. */
export const DUEL_STATES = ["none", "sealed", "picking", "settling", "forfeited", "refunded", "finalized"] as const;
export type DuelState = (typeof DUEL_STATES)[number];

export const duelEntryRequest = (chainId: ChainId, message: MarketDuelEntry) =>
  ({ domain: duelDomain(chainId), types: DUEL_ENTRY_TYPES, primaryType: "DuelEntry", message }) as const;

export const duelPickRequest = (chainId: ChainId, message: MarketDuelPick) =>
  ({ domain: duelDomain(chainId), types: DUEL_PICK_TYPES, primaryType: "DuelPick", message }) as const;

/** The entry's digest: the queue's idempotency key. */
export const duelEntryDigest = (chainId: ChainId, entry: MarketDuelEntry): Hex =>
  hashTypedData(duelEntryRequest(chainId, entry));

export const duelPickDigest = (chainId: ChainId, pick: MarketDuelPick): Hex =>
  hashTypedData(duelPickRequest(chainId, pick));

/** A player's half of the deck's randomness (`crypto.getRandomValues`, as the nonces). */
export function freshSeed(): Hex {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(SEED_BYTES)));
}

/** The key that signed an entry (the owner's, for the queue to check before it waits; the arena checks again). */
export const duelEntrySigner = (chainId: ChainId, entry: MarketDuelEntry, signature: Hex): Promise<Address> =>
  recoverTypedDataAddress({ ...duelEntryRequest(chainId, entry), signature });

/** The key that signed a pick (the player's or the seat's key). */
export const duelPickSigner = (chainId: ChainId, pick: MarketDuelPick, signature: Hex): Promise<Address> =>
  recoverTypedDataAddress({ ...duelPickRequest(chainId, pick), signature });

/** What an entry needs at the moment it is paired: dollars, the arena's allowance (or a permit), the owner's epoch. */
export async function readDuelAccount(
  read: ReadClient,
  chainId: ChainId,
  owner: Address,
): Promise<{ balance: bigint; allowance: bigint; epoch: number }> {
  const token = dollarTokenOf(chainId);
  if (!token) throw new NotDeployedError(chainId, "TestUSD");
  const [balance, allowance, epoch] = await Promise.all([
    read.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [owner] }),
    read.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "allowance",
      args: [owner, addressOf(chainId, "DuelArena")],
    }),
    read.readContract({
      address: addressOf(chainId, "BandReserve"),
      abi: bandReserveAbi,
      functionName: "epochOf",
      args: [owner],
    }),
  ]);
  return { balance, allowance, epoch: Number(epoch) };
}

/** Whether a reserve window has settled (a card's calls are then ready for `settleCard`). */
export const windowSettled = (read: ReadClient, chainId: ChainId, windowId: Hex): Promise<boolean> =>
  read.readContract({
    address: addressOf(chainId, "BandReserve"),
    abi: bandReserveAbi,
    functionName: "windowSettled",
    args: [windowId],
  });

/** A match's state on chain (`none` when the arena never took it) and its reveal deadline. */
export async function readDuelState(
  read: ReadClient,
  chainId: ChainId,
  matchId: Hex,
): Promise<{ state: DuelState; revealBy: number }> {
  const [m] = await read.readContract({
    address: addressOf(chainId, "DuelArena"),
    abi: duelArenaAbi,
    functionName: "matchOf",
    args: [matchId],
  });
  const revealWindow = await read.readContract({
    address: addressOf(chainId, "DuelArena"),
    abi: duelArenaAbi,
    functionName: "revealWindowSec",
  });
  return { state: DUEL_STATES[m.status] ?? "none", revealBy: m.openedAt + revealWindow };
}

/** The match id the matchmaker names: both entries' digests in seat order. */
export const matchIdOf = (digestA: Hex, digestB: Hex): Hex => keccak256(concat([digestA, digestB]));

/** `DuelArena.deckHashOf`: the chain, the arena, the match, the server's seed, both seats' seeds and the cards. */
export function deckHashOf(
  chainId: ChainId,
  matchId: Hex,
  serverSeed: Hex,
  seeds: readonly [Hex, Hex],
  cards: readonly [Hex, Hex, Hex],
): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "address" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32[2]" },
        { type: "bytes32[3]" },
      ],
      [BigInt(chainId), addressOf(chainId, "DuelArena"), matchId, serverSeed, seeds, cards],
    ),
  );
}

// ------------------------------------------------------------------------------------------------ calldata

export function openMatchCallData(matchId: Hex, a: SignedDuelEntry, b: SignedDuelEntry, deckHash: Hex): Hex {
  return encodeFunctionData({
    abi: duelArenaAbi,
    functionName: "openMatch",
    args: [matchId, a.entry, a.signature, a.permit ?? NO_PERMIT, b.entry, b.signature, b.permit ?? NO_PERMIT, deckHash],
  });
}

export function revealDeckCallData(matchId: Hex, serverSeed: Hex, cards: readonly [Hex, Hex, Hex]): Hex {
  return encodeFunctionData({ abi: duelArenaAbi, functionName: "revealDeck", args: [matchId, serverSeed, cards] });
}

/** The reveal in one transaction: every card's window opened with its line (allowed to fail), then the reveal. */
export function openCardsAndRevealData(
  chainId: ChainId,
  cards: readonly LegWindow[],
  revealData: Hex,
  revealMayFail = false,
): Hex {
  const calls = openWindowCalls(chainId, cards);
  calls.push({ target: addressOf(chainId, "DuelArena"), allowFailure: revealMayFail, callData: revealData });
  return aggregate(calls);
}

export function duelPickCallData(pick: MarketDuelPick, signature: Hex): Hex {
  return encodeFunctionData({ abi: duelArenaAbi, functionName: "pick", args: [pick, signature] });
}

/** One keeper step on a match (each allowed to fail in the batch: someone may have done it). */
export type DuelStep =
  | { kind: "refundUnrevealed"; matchId: Hex }
  | { kind: "lockPicks"; matchId: Hex }
  | { kind: "settleCard"; matchId: Hex; card: number }
  | { kind: "finalize"; matchId: Hex };

function stepCallData(s: DuelStep): Hex {
  if (s.kind === "settleCard") {
    return encodeFunctionData({ abi: duelArenaAbi, functionName: "settleCard", args: [s.matchId, s.card] });
  }
  return encodeFunctionData({ abi: duelArenaAbi, functionName: s.kind, args: [s.matchId] });
}

/** The keeper's steps in one Multicall3 batch, in order (a lock before the cards, the cards before the pot). */
export function duelStepsData(chainId: ChainId, steps: readonly DuelStep[]): Hex {
  const arena = addressOf(chainId, "DuelArena");
  const calls: Call[] = steps.map((s) => ({ target: arena, allowFailure: true, callData: stepCallData(s) }));
  return aggregate(calls);
}

// ------------------------------------------------------------------------------------------------ events

export type DuelChange =
  | {
      kind: "matchOpened";
      matchId: Hex;
      playerA: Address;
      playerB: Address;
      tier: number;
      pot: bigint;
      cardStake: bigint;
      revealBy: number;
    }
  | { kind: "deckRevealed"; matchId: Hex; serverSeed: Hex; cards: Hex[]; pickDeadline: number }
  | { kind: "pickPlaced"; matchId: Hex; player: Address; card: number; band: number; ticketId: bigint }
  | { kind: "picksLocked"; matchId: Hex; state: DuelState; forfeitedBy: Address | null }
  | { kind: "budgetReturned"; matchId: Hex; player: Address; amount: bigint }
  | { kind: "cardSettled"; matchId: Hex; player: Address; card: number; returned: bigint; result: bigint }
  | { kind: "matchFinalized"; matchId: Hex; winner: Address | null; resultA: bigint; resultB: bigint; pot: bigint }
  | { kind: "matchRefunded"; matchId: Hex; reason: number; perSeat: bigint };

const ZERO = "0x0000000000000000000000000000000000000000";
const orNull = (a: unknown): Address | null => (a === ZERO ? null : (a as Address));

/** The arena's events in a receipt, in order (other logs ignored). */
export function duelChanges(logs: readonly Log[], arena: Address): DuelChange[] {
  const out: DuelChange[] = [];
  for (const log of logs) {
    if (log.address.toLowerCase() !== arena.toLowerCase()) continue;
    let e: ReturnType<typeof decodeEventLog<typeof duelArenaAbi>>;
    try {
      e = decodeEventLog({ abi: duelArenaAbi, data: log.data, topics: log.topics });
    } catch {
      continue;
    }
    const a = e.args as Record<string, unknown>;
    const matchId = a.matchId as Hex;
    switch (e.eventName) {
      case "MatchOpened":
        out.push({
          kind: "matchOpened",
          matchId,
          playerA: a.playerA as Address,
          playerB: a.playerB as Address,
          tier: Number(a.tier),
          pot: a.pot as bigint,
          cardStake: a.cardStake as bigint,
          revealBy: Number(a.revealBy),
        });
        break;
      case "DeckRevealed":
        out.push({
          kind: "deckRevealed",
          matchId,
          serverSeed: a.serverSeed as Hex,
          cards: [...(a.cards as readonly Hex[])],
          pickDeadline: Number(a.pickDeadline),
        });
        break;
      case "PickPlaced":
        out.push({
          kind: "pickPlaced",
          matchId,
          player: a.player as Address,
          card: Number(a.card),
          band: Number(a.band),
          ticketId: a.ticketId as bigint,
        });
        break;
      case "PicksLocked":
        out.push({
          kind: "picksLocked",
          matchId,
          state: DUEL_STATES[Number(a.status)] ?? "none",
          forfeitedBy: orNull(a.forfeitedBy),
        });
        break;
      case "BudgetReturned":
        out.push({ kind: "budgetReturned", matchId, player: a.player as Address, amount: a.amount as bigint });
        break;
      case "CardSettled":
        out.push({
          kind: "cardSettled",
          matchId,
          player: a.player as Address,
          card: Number(a.card),
          returned: a.returned as bigint,
          result: a.result as bigint,
        });
        break;
      case "MatchFinalized":
        out.push({
          kind: "matchFinalized",
          matchId,
          winner: orNull(a.winner),
          resultA: a.resultA as bigint,
          resultB: a.resultB as bigint,
          pot: a.pot as bigint,
        });
        break;
      case "MatchRefunded":
        out.push({ kind: "matchRefunded", matchId, reason: Number(a.reason), perSeat: a.perSeat as bigint });
        break;
      default:
        break;
    }
  }
  return out;
}
