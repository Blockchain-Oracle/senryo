/**
 * The yes/no book's events as changes for the services (S8.7, D-296): a receipt's `EventBook` logs, in order, decoded
 * into what `market_events`, `event_answers` and `event_calls` apply.
 */

import { eventBookAbi } from "@senryo/contracts/abis";
import { type Address, decodeEventLog, type Hex, type Log } from "viem";
import { EVENT_OUTCOMES, EVENT_VOID_REASONS, type EventOutcome, type EventVoidReason } from "./events.ts";

export type EventChange =
  | {
      kind: "listed";
      eventId: Hex;
      committeeId: number;
      feeBps: number;
      closesAt: number;
      answerFrom: number;
      answerBy: number;
      termsHash: Hex;
      question: string;
      rules: string;
    }
  | {
      kind: "called";
      eventId: Hex;
      ticketId: bigint;
      owner: Address;
      yes: boolean;
      stake: bigint;
      yesPool: bigint;
      noPool: bigint;
    }
  | { kind: "answered"; eventId: Hex; member: Address; yes: boolean; statementHash: Hex; attestedAt: number }
  | { kind: "decided"; eventId: Hex; yes: boolean; yesPool: bigint; noPool: bigint; fee: bigint; prize: bigint }
  | { kind: "voided"; eventId: Hex; reason: EventVoidReason; answer: boolean }
  | { kind: "paid"; ticketId: bigint; eventId: Hex; owner: Address; outcome: EventOutcome; amount: bigint }
  | { kind: "feesSwept"; amount: bigint };

/** The book's events in a receipt, in order (other logs ignored). */
export function eventChanges(logs: readonly Log[], book: Address): EventChange[] {
  const out: EventChange[] = [];
  for (const log of logs) {
    if (log.address.toLowerCase() !== book.toLowerCase()) continue;
    let e: ReturnType<typeof decodeEventLog<typeof eventBookAbi>>;
    try {
      e = decodeEventLog({ abi: eventBookAbi, data: log.data, topics: log.topics });
    } catch {
      continue;
    }
    const a = e.args as Record<string, unknown>;
    switch (e.eventName) {
      case "EventListed":
        out.push({
          kind: "listed",
          eventId: a.eventId as Hex,
          committeeId: Number(a.committeeId),
          feeBps: a.feeBps as number,
          closesAt: Number(a.closesAt),
          answerFrom: Number(a.answerFrom),
          answerBy: Number(a.answerBy),
          termsHash: a.termsHash as Hex,
          question: a.question as string,
          rules: a.rules as string,
        });
        break;
      case "Called":
        out.push({
          kind: "called",
          eventId: a.eventId as Hex,
          ticketId: a.ticketId as bigint,
          owner: a.owner as Address,
          yes: a.yes as boolean,
          stake: a.stake as bigint,
          yesPool: a.yesPool as bigint,
          noPool: a.noPool as bigint,
        });
        break;
      case "Answered":
        out.push({
          kind: "answered",
          eventId: a.eventId as Hex,
          member: a.member as Address,
          yes: a.yes as boolean,
          statementHash: a.statementHash as Hex,
          attestedAt: Number(a.attestedAt),
        });
        break;
      case "EventDecided":
        out.push({
          kind: "decided",
          eventId: a.eventId as Hex,
          yes: a.yes as boolean,
          yesPool: a.yesPool as bigint,
          noPool: a.noPool as bigint,
          fee: a.fee as bigint,
          prize: a.prize as bigint,
        });
        break;
      case "EventVoided":
        out.push({
          kind: "voided",
          eventId: a.eventId as Hex,
          reason: EVENT_VOID_REASONS[Number(a.reason)] ?? "none",
          answer: a.answer as boolean,
        });
        break;
      case "CallPaid":
        out.push({
          kind: "paid",
          ticketId: a.ticketId as bigint,
          eventId: a.eventId as Hex,
          owner: a.owner as Address,
          outcome: EVENT_OUTCOMES[Number(a.outcome)] ?? "lost",
          amount: a.amount as bigint,
        });
        break;
      case "FeesSwept":
        out.push({ kind: "feesSwept", amount: a.amount as bigint });
        break;
      default:
        break;
    }
  }
  return out;
}
