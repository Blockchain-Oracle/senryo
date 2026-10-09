/**
 * Yes/no events (S8.7, D-296) for the apps, the api and the keeper: the EIP-712 `EventCall` and `EventAnswer` exactly
 * as `EventBook` hashes them (domain "Senryo Events" v1 on the book), an event's id and terms hash, a committee
 * member's statement and its hash, the payout maths mirrored from the book, the calldata of every step, and the book's
 * events as changes for the services.
 */

import { type ChainId, EVENTS } from "@senryo/config";
import { bandReserveAbi, eventBookAbi } from "@senryo/contracts/abis";
import {
  type Address,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  type Hex,
  hashTypedData,
  keccak256,
  recoverTypedDataAddress,
  toBytes,
} from "viem";
import type { ReadClient } from "./clients.ts";
import { addressOf, dollarTokenOf, NotDeployedError } from "./contracts.ts";
import { NO_PERMIT, type PermitArgs } from "./market-calls.ts";
import { aggregate, type Call } from "./markets.ts";

const BPS = 10_000n;

export const EVENT_DOMAIN_NAME = "Senryo Events";
export const EVENT_DOMAIN_VERSION = "1";

export function eventDomain(chainId: ChainId) {
  return {
    name: EVENT_DOMAIN_NAME,
    version: EVENT_DOMAIN_VERSION,
    chainId,
    verifyingContract: addressOf(chainId, "EventBook"),
  } as const;
}

export const EVENT_CALL_TYPES = {
  EventCall: [
    { name: "owner", type: "address" },
    { name: "eventId", type: "bytes32" },
    { name: "yes", type: "bool" },
    { name: "stake", type: "uint64" },
    { name: "deadline", type: "uint64" },
    { name: "nonce", type: "uint256" },
    { name: "epoch", type: "uint32" },
  ],
} as const;

export const EVENT_ANSWER_TYPES = {
  EventAnswer: [
    { name: "eventId", type: "bytes32" },
    { name: "termsHash", type: "bytes32" },
    { name: "member", type: "address" },
    { name: "yes", type: "bool" },
    { name: "statementHash", type: "bytes32" },
    { name: "attestedAt", type: "uint40" },
  ],
} as const;

export interface MarketEventCall {
  owner: Address;
  eventId: Hex;
  yes: boolean;
  stake: bigint;
  deadline: bigint;
  nonce: bigint;
  epoch: number;
}

export interface MarketEventAnswer {
  eventId: Hex;
  termsHash: Hex;
  member: Address;
  yes: boolean;
  statementHash: Hex;
  attestedAt: number;
}

/** The book's event states and void reasons, by their on-chain code. */
export const EVENT_STATES = ["none", "open", "decided", "voided"] as const;
export type EventState = (typeof EVENT_STATES)[number];
export const EVENT_VOID_REASONS = ["none", "disagreement", "quorum", "no-winners"] as const;
export type EventVoidReason = (typeof EVENT_VOID_REASONS)[number];
/** `CallPaid.outcome`: the reserve's outcome codes. */
export const EVENT_OUTCOMES = ["lost", "won", "refunded"] as const;
export type EventOutcome = (typeof EVENT_OUTCOMES)[number];

export const eventCallRequest = (chainId: ChainId, message: MarketEventCall) =>
  ({ domain: eventDomain(chainId), types: EVENT_CALL_TYPES, primaryType: "EventCall", message }) as const;

export const eventAnswerRequest = (chainId: ChainId, message: MarketEventAnswer) =>
  ({ domain: eventDomain(chainId), types: EVENT_ANSWER_TYPES, primaryType: "EventAnswer", message }) as const;

/** The call's digest: the relay's idempotency key. */
export const eventCallDigest = (chainId: ChainId, c: MarketEventCall): Hex =>
  hashTypedData(eventCallRequest(chainId, c));

export const eventCallSigner = (chainId: ChainId, c: MarketEventCall, signature: Hex): Promise<Address> =>
  recoverTypedDataAddress({ ...eventCallRequest(chainId, c), signature });

// ------------------------------------------------------------------------------------------------ ids and terms

/** One real-world question, one id: `senryo-event-v1:<league>:<game>` hashed, so a re-run listing is refused. */
export const eventIdOf = (league: string, gameKey: string): Hex =>
  keccak256(toBytes(`${EVENTS.statementDomain}:${league}:${gameKey}`));

/** `EventBook.termsHashOf`: the event, its question and its rules. */
export const eventTermsHashOf = (eventId: Hex, question: string, rules: string): Hex =>
  keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }],
      [eventId, keccak256(toBytes(question)), keccak256(toBytes(rules))],
    ),
  );

/**
 * One member's statement: what its answer's `statementHash` commits to — the event, the question, the answer, what
 * the member read (where, and the result it saw), who it is and when. Kept by the api so anyone can re-hash it.
 */
export interface EventStatement {
  chainId: ChainId;
  book: Address;
  eventId: Hex;
  question: string;
  answer: "yes" | "no";
  /** The URL the member read. */
  source: string;
  /** The result it saw there, in its own words ("final: BOS 6, UTA 1"). */
  read: string;
  member: string;
  attestedAt: number;
}

/** The canonical statement text: fixed key order, one JSON line, so the same statement always hashes the same. */
export function eventStatementText(s: EventStatement): string {
  if (!s.question.trim() || !s.source.trim() || !s.read.trim()) throw new Error("a statement names what was read");
  return JSON.stringify({
    domain: EVENTS.statementDomain,
    chainId: s.chainId,
    book: s.book.toLowerCase(),
    eventId: s.eventId,
    question: s.question,
    answer: s.answer,
    source: s.source,
    read: s.read,
    member: s.member,
    attestedAt: s.attestedAt,
  });
}

export const statementHashOf = (text: string): Hex => keccak256(toBytes(text));

// ------------------------------------------------------------------------------------------------ payouts

/** The book's fee on a losing side (`lose × feeBps / 10 000`, rounded down as the book does). */
export const eventFeeOf = (lose: bigint, feeBps: number): bigint => (lose * BigInt(feeBps)) / BPS;

/**
 * `EventBook.estimatePayout`: what `stake` on a side returns if that side wins with the pools as they are, this stake
 * included — the stake back plus its share of the other side less the fee. An estimate: the final pools decide.
 */
export function estimateEventPayout(
  pools: { yes: bigint; no: bigint },
  yes: boolean,
  stake: bigint,
  feeBps: number,
): bigint {
  const win = (yes ? pools.yes : pools.no) + stake;
  const lose = yes ? pools.no : pools.yes;
  if (win === 0n) return 0n;
  return stake + (stake * (lose - eventFeeOf(lose, feeBps))) / win;
}

/** A settled call's payout as the book pays it: its stake plus its share of the prize when it called right. */
export const eventWinOf = (stake: bigint, prize: bigint, winPool: bigint): bigint =>
  winPool === 0n ? stake : stake + (stake * prize) / winPool;

// ------------------------------------------------------------------------------------------------ reads

/** What a call needs when it is relayed: dollars, the book's allowance (or a permit), the owner's epoch. */
export async function readEventAccount(
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
      args: [owner, addressOf(chainId, "EventBook")],
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

/** An event as the book holds it now. */
export async function readEvent(read: ReadClient, chainId: ChainId, eventId: Hex) {
  const m = await read.readContract({
    address: addressOf(chainId, "EventBook"),
    abi: eventBookAbi,
    functionName: "eventOf",
    args: [eventId],
  });
  return {
    state: EVENT_STATES[m.state] ?? "none",
    voidReason: EVENT_VOID_REASONS[m.voidReason] ?? "none",
    answer: m.answer,
    answered: m.answered,
    yesVotes: m.yesVotes,
    noVotes: m.noVotes,
    quorumAt: m.quorumAt,
    closesAt: m.closesAt,
    answerFrom: m.answerFrom,
    answerBy: m.answerBy,
    openCalls: m.openCalls,
    yesPool: m.yesPool,
    noPool: m.noPool,
    termsHash: m.termsHash,
  };
}

// ------------------------------------------------------------------------------------------------ calldata

export interface EventTermsArgs {
  eventId: Hex;
  committeeId: number;
  feeBps: number;
  closesAt: number;
  answerFrom: number;
  answerBy: number;
}

export interface EventListing {
  terms: EventTermsArgs;
  question: string;
  rules: string;
}

/** Several listings in one transaction from the lister (the book's own `multicall`, which keeps the caller). */
export function listEventsData(listings: readonly EventListing[]): Hex {
  const calls = listings.map((l) =>
    encodeFunctionData({ abi: eventBookAbi, functionName: "listEvent", args: [l.terms, l.question, l.rules] }),
  );
  return encodeFunctionData({ abi: eventBookAbi, functionName: "multicall", args: [calls] });
}

export function placeEventCallData(c: MarketEventCall, signature: Hex, permit: PermitArgs | null): Hex {
  return encodeFunctionData({
    abi: eventBookAbi,
    functionName: "placeCall",
    args: [c, signature, permit ?? NO_PERMIT],
  });
}

/** One keeper step on the book: each is permissionless, so the batch runs them through Multicall3, each allowed to fail. */
export type EventStep =
  | { kind: "answer"; answer: MarketEventAnswer; signature: Hex }
  | { kind: "resolve"; eventId: Hex }
  | { kind: "claimFor"; ticketIds: readonly bigint[] }
  | { kind: "sweepFees" };

function stepCallData(s: EventStep): Hex {
  switch (s.kind) {
    case "answer":
      return encodeFunctionData({ abi: eventBookAbi, functionName: "answer", args: [s.answer, s.signature] });
    case "resolve":
      return encodeFunctionData({ abi: eventBookAbi, functionName: "resolve", args: [s.eventId] });
    case "claimFor":
      return encodeFunctionData({ abi: eventBookAbi, functionName: "claimFor", args: [[...s.ticketIds]] });
    default:
      return encodeFunctionData({ abi: eventBookAbi, functionName: "sweepFees" });
  }
}

/** The keeper's steps in one Multicall3 batch, in order (answers before a resolve, a verdict before its payouts). */
export function eventStepsData(chainId: ChainId, steps: readonly EventStep[]): Hex {
  const book = addressOf(chainId, "EventBook");
  const calls: Call[] = steps.map((s) => ({ target: book, allowFailure: true, callData: stepCallData(s) }));
  return aggregate(calls);
}

/** The book's fees waiting for `sweepFees`. */
export const readEventFees = (read: ReadClient, chainId: ChainId): Promise<bigint> =>
  read.readContract({ address: addressOf(chainId, "EventBook"), abi: eventBookAbi, functionName: "feesHeld" });
