import {
  addressOf,
  eventAnswerRequest,
  eventStatementText,
  type Hex,
  type MarketEventAnswer,
  type Signer,
  statementHashOf,
} from "@senryo/chain";
import { type ChainId, type CommitteeMember, EVENT_COMMITTEES, type EventSourceKey } from "@senryo/config";
import { type EventRow, type Logger, loadOptionalSigner } from "@senryo/service-common";
import { EVENT_SIGNER_PREFIX } from "../constants.ts";
import type { GameReader, GameRef } from "./game.ts";
import { espnResult } from "./sources/espn.ts";
import { leagueResult } from "./sources/league.ts";
import { thescoreResult } from "./sources/thescore.ts";

/**
 * The Senryo-run committee (S8.7, D-296): one signer per member, each reading only its own source, in committee order
 * (`EVENT_SIGNER_1_PK` is the first member). A member whose key is missing or doesn't match the committee's address
 * stays silent — the quorum of the others still decides, and a silence never decides anything on its own.
 */
const READERS: Readonly<Record<EventSourceKey, GameReader>> = {
  league: leagueResult,
  espn: espnResult,
  thescore: thescoreResult,
};

/** An answer is dated a little behind the wall clock, so the chain's own clock is never behind it. */
const ANSWER_CLOCK_MARGIN_SEC = 5;

export interface Member {
  spec: CommitteeMember;
  signer: Signer;
  read: GameReader;
}

export interface Committee {
  id: number;
  members: Member[];
}

export function loadCommittee(chainId: ChainId, log: Logger): Committee | null {
  const spec = EVENT_COMMITTEES[chainId];
  if (!spec) return null;
  const members: Member[] = [];
  spec.members.forEach((m, i) => {
    const signer = loadOptionalSigner(`${EVENT_SIGNER_PREFIX}_${i + 1}`);
    if (!signer) {
      log.warn({ member: m.name }, "committee member has no key here; it stays silent");
    } else if (signer.address.toLowerCase() !== m.address.toLowerCase()) {
      log.error({ member: m.name, want: m.address, got: signer.address }, "committee key is not the member's; silent");
    } else {
      members.push({ spec: m, signer, read: READERS[m.source] });
    }
  });
  return { id: spec.id, members };
}

/** The game an event row is about, as the readers look it up. */
export const gameOf = (e: EventRow): GameRef => ({
  league: e.league as GameRef["league"],
  key: e.game_key,
  startSec: Number(e.starts_at),
  home: e.home,
  away: e.away,
});

/** When a member may date an answer now: never before the event's answer window opens. */
export function answerTime(e: EventRow, nowSec: number): number | null {
  const at = nowSec - ANSWER_CLOCK_MARGIN_SEC;
  return at >= Number(e.answer_from) ? at : null;
}

export interface SignedAnswer {
  answer: MarketEventAnswer;
  signature: Hex;
  statement: string;
}

/** A member's answer on what it read: the statement, its hash, and the member's signature over both and the terms. */
export async function signAnswer(
  chainId: ChainId,
  member: Member,
  e: EventRow,
  result: { home: number; away: number; source: string; read: string },
  attestedAt: number,
): Promise<SignedAnswer> {
  const yes = result.home > result.away;
  const statement = eventStatementText({
    chainId,
    book: addressOf(chainId, "EventBook"),
    eventId: e.event_id as Hex,
    question: e.question,
    answer: yes ? "yes" : "no",
    source: result.source,
    read: result.read,
    member: member.spec.name,
    attestedAt,
  });
  const answer: MarketEventAnswer = {
    eventId: e.event_id as Hex,
    termsHash: e.terms_hash as Hex,
    member: member.signer.address,
    yes,
    statementHash: statementHashOf(statement),
    attestedAt,
  };
  const signature = await member.signer.signTypedData(eventAnswerRequest(chainId, answer));
  return { answer, signature, statement };
}
