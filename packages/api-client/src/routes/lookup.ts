import * as z from "zod";
import { chainIdSchema, unixSecondsSchema } from "../primitives.ts";
import { defineRoute } from "./define.ts";

/**
 * A pasted id (R6.6): a transaction hash or a 32-byte id, or a call, ride or parlay number — what of ours carries it,
 * read from the indexer. A hash can name several things (a duel pick opens a call too); a number names each kind
 * that has one. Public, like the chain it mirrors; empty when nothing does.
 */
export const LOOKUP_KINDS = ["call", "ride", "parlay", "duel", "event", "window"] as const;
export type LookupKind = (typeof LOOKUP_KINDS)[number];
/** The longest query the lookup reads: a hash is 66 characters, a folio less. */
export const LOOKUP_QUERY_MAX = 80;
export const LOOKUP_HITS_MAX = 8;

export const lookupHitSchema = z.object({
  kind: z.enum(LOOKUP_KINDS),
  /** The id its page opens on: a call's ticket, a ride's id, a duel's match, an event's id, a window's id. */
  id: z.string(),
  /** The market, where it has one. */
  symbol: z.string().nullable(),
  /** When it was made. */
  at: unixSecondsSchema.nullable(),
  /** An event call's own ticket (the event is the page). */
  ref: z.string().nullable(),
});
export type LookupHit = z.output<typeof lookupHitSchema>;

export const lookupRoute = defineRoute({
  method: "GET",
  path: "/v1/lookup",
  auth: "none",
  params: undefined,
  query: z.object({
    chainId: z.coerce.number().pipe(chainIdSchema),
    q: z.string().trim().min(1).max(LOOKUP_QUERY_MAX),
  }),
  body: undefined,
  response: z.object({ hits: z.array(lookupHitSchema).max(LOOKUP_HITS_MAX) }),
});
