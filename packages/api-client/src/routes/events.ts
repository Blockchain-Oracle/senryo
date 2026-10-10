/**
 * Yes/no events (S8.7, D-296): the board (open questions and the ones just settled, their pools moving live on the
 * public `markets` topic as `event`), one event with its committee and every member's signed statement, a caller's
 * calls, and a signed call relayed gas-free (the caller's stream hears of it and of its payout as `eventCall`).
 */
import * as z from "zod";
import {
  addressSchema,
  bytes32Schema,
  chainIdSchema,
  hexSchema,
  isoTimeSchema,
  txHashSchema,
  uintCodec,
  unixSecondsSchema,
} from "../primitives.ts";
import { defineRoute } from "./define.ts";
import { permitSchema } from "./markets.ts";

const chainQuery = { chainId: z.coerce.number().pipe(chainIdSchema) };
const TEXT_MAX = 600;

export const eventCallSchema = z.object({
  owner: addressSchema,
  eventId: bytes32Schema,
  yes: z.boolean(),
  stake: uintCodec,
  deadline: uintCodec,
  nonce: uintCodec,
  epoch: z.int().nonnegative(),
});

/** A side: name and abbreviation; its mark is the registry's (`ids.team(league, abbr)`, R2.7), never a feed's URL. */
export const eventTeamSchema = z.object({
  name: z.string().max(TEXT_MAX),
  abbr: z.string().max(TEXT_MAX),
});

export const EVENT_VIEW_STATES = ["open", "decided", "voided"] as const;
export const EVENT_VOID_VIEW_REASONS = ["disagreement", "quorum", "no-winners"] as const;

export const eventSchema = z.object({
  eventId: bytes32Schema,
  league: z.string(),
  question: z.string().max(TEXT_MAX),
  rules: z.string().max(TEXT_MAX),
  termsHash: bytes32Schema,
  home: eventTeamSchema,
  away: eventTeamSchema,
  startsAt: unixSecondsSchema,
  /** Calls close here; the committee may answer from `answerFrom` to `answerBy`. */
  closesAt: unixSecondsSchema,
  answerFrom: unixSecondsSchema,
  answerBy: unixSecondsSchema,
  feeBps: z.int().nonnegative(),
  state: z.enum(EVENT_VIEW_STATES),
  yesPool: uintCodec,
  noPool: uintCodec,
  calls: z.int().nonnegative(),
  /** The committee's answer (true = Yes): once decided, or voided because nobody called it. */
  answer: z.boolean().nullable(),
  voidReason: z.enum(EVENT_VOID_VIEW_REASONS).nullable(),
  fee: uintCodec.nullable(),
  prize: uintCodec.nullable(),
  decidedAt: isoTimeSchema.nullable(),
  listedTx: txHashSchema.nullable(),
});

export type EventView = z.output<typeof eventSchema>;

export const committeeSchema = z.object({
  id: z.int(),
  quorum: z.int(),
  runBy: z.string(),
  members: z.array(z.object({ address: addressSchema, name: z.string(), reads: z.string() })),
});

export type CommitteeView = z.output<typeof committeeSchema>;

export const eventAnswerSchema = z.object({
  member: addressSchema,
  yes: z.boolean(),
  /** The member's full statement: re-hash it (keccak-256 of its UTF-8) and it is `statementHash`. */
  statement: z.string(),
  statementHash: bytes32Schema,
  attestedAt: unixSecondsSchema,
  posted: z.boolean(),
  txHash: txHashSchema.nullable(),
});

export type EventAnswerView = z.output<typeof eventAnswerSchema>;

export const EVENT_CALL_STATES = ["open", "won", "lost", "refunded"] as const;

export const eventCallViewSchema = z.object({
  ticketId: uintCodec,
  eventId: bytes32Schema,
  question: z.string(),
  yes: z.boolean(),
  stake: uintCodec,
  status: z.enum(EVENT_CALL_STATES),
  /** What it paid (the stake back plus a share on a win, the stake on a refund, 0 on a loss). */
  amount: uintCodec.nullable(),
  callTx: txHashSchema.nullable(),
  paidTx: txHashSchema.nullable(),
  createdAt: isoTimeSchema,
});

export type EventCallView = z.output<typeof eventCallViewSchema>;

export const eventBoardRoute = defineRoute({
  method: "GET",
  path: "/v1/events",
  auth: "none",
  params: undefined,
  query: z.object(chainQuery),
  body: undefined,
  response: z.object({ events: z.array(eventSchema), committee: committeeSchema.nullable() }),
});

export const eventDetailRoute = defineRoute({
  method: "GET",
  path: "/v1/events/:eventId",
  auth: "none",
  params: z.object({ eventId: bytes32Schema }),
  query: z.object(chainQuery),
  body: undefined,
  response: z.object({ event: eventSchema, committee: committeeSchema, answers: z.array(eventAnswerSchema) }),
});

export const eventCallsRoute = defineRoute({
  method: "GET",
  path: "/v1/event-calls",
  auth: "none",
  params: undefined,
  query: z.object({ ...chainQuery, owner: addressSchema }),
  body: undefined,
  response: z.object({ calls: z.array(eventCallViewSchema) }),
});

export const placeEventCallRoute = defineRoute({
  method: "POST",
  path: "/v1/event-calls",
  auth: "none",
  params: undefined,
  query: undefined,
  body: z.object({
    chainId: chainIdSchema,
    call: eventCallSchema,
    signature: hexSchema,
    permit: permitSchema.nullable(),
  }),
  response: z.object({ ticketId: uintCodec, txHash: txHashSchema }),
});
