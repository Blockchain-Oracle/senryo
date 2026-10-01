import { z } from "zod";
import { addressSchema, chainIdSchema, isoTimeSchema } from "../primitives.ts";
import {
  HANDLE_MAX_CHARS,
  ID_CURSOR_PATTERN,
  MARKET_ID_PATTERN,
  POSITION_ID_PATTERN,
  POST_KINDS,
  POST_MAX_CHARS,
  REPLIES_PAGE_DEFAULT,
  REPORT_NOTE_MAX_CHARS,
  REPORT_REASONS,
} from "../social.ts";
import { defineRoute } from "./define.ts";
import { avatarIdSchema, chainQuerySchema } from "./profile.ts";
import { deletedResponseSchema } from "./storage.ts";

/**
 * Posts (S12b.6, D-174): theses and one-level replies (a reply's parent is a thesis), likes and reports.
 * - Writing needs a session AND the author's profile listed on that network (403 NOT_LISTED otherwise), runs the
 *   content filter (400 CONTENT_BLOCKED) and a per-account hourly budget (429 RATE_LIMITED).
 * - A block in either direction stops replies and likes (403 BLOCKED).
 * - Reports are weighted: only reporters who claimed the starter or funded an account count. A target is hidden only
 *   when its weighted reports reach the review bar AND an admin review says "hide" (sybils can't brigade it).
 * Following is not copy trading; a thesis is opinion, never an order.
 */

/** No control characters except line breaks. */
const POST_TEXT = /^(?:[^\p{Cc}]|\n)*$/u;
const NO_CONTROL = /^[^\p{Cc}]*$/u;

/** Who wrote or did something — only ever an account listed on the network it is shown on. */
export const socialIdentitySchema = z.object({
  address: addressSchema,
  handle: z.string().max(HANDLE_MAX_CHARS).nullable(),
  displayName: z.string().nullable(),
  avatar: avatarIdSchema.nullable(),
});

export const marketIdSchema = z.string().regex(MARKET_ID_PATTERN, "expected an indexer market id (ours-0, perpl-16)");
export const positionIdSchema = z.string().regex(POSITION_ID_PATTERN, "expected an indexer position id");
export const idCursorSchema = z.string().regex(ID_CURSOR_PATTERN, "expected a page cursor");

export const postSchema = z.object({
  id: z.uuid(),
  chainId: chainIdSchema,
  kind: z.enum(POST_KINDS),
  /** The thesis a reply answers; null for a thesis. */
  parentId: z.uuid().nullable(),
  author: socialIdentitySchema,
  marketId: marketIdSchema.nullable(),
  /** The author's own indexed position the thesis is about (verified against the indexer when posted). */
  positionId: positionIdSchema.nullable(),
  text: z.string(),
  likes: z.int().nonnegative(),
  /** Visible replies (thesis only; 0 for a reply). */
  replies: z.int().nonnegative(),
  /** The session account liked it (false without a session). */
  likedByMe: z.boolean(),
  createdAt: isoTimeSchema,
});

export const postCreateSchema = z
  .object({
    chainId: chainIdSchema,
    kind: z.enum(POST_KINDS),
    parentId: z.uuid().optional(),
    marketId: marketIdSchema.optional(),
    positionId: positionIdSchema.optional(),
    /** Trimmed server-side; 1–280 characters after trimming. */
    text: z.string().min(1).max(POST_MAX_CHARS).regex(POST_TEXT, "no control characters"),
  })
  .refine((p) => (p.kind === "reply") === (p.parentId !== undefined), {
    message: "a reply needs parentId; a thesis has none",
    path: ["parentId"],
  });

export const postParamsSchema = z.object({ id: z.uuid() });

export const threadQuerySchema = chainQuerySchema.extend({
  /** `nextCursor` of the previous replies page. */
  cursor: idCursorSchema.optional(),
  limit: z.coerce.number().int().positive().max(REPLIES_PAGE_DEFAULT).optional(),
});

/** A thesis with its replies, oldest reply first. */
export const threadSchema = z.object({
  post: postSchema,
  replies: z.array(postSchema),
  nextCursor: idCursorSchema.nullable(),
});

export const likeStateSchema = z.object({ postId: z.uuid(), liked: z.boolean(), likes: z.int().nonnegative() });

export const reportRequestSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  note: z.string().max(REPORT_NOTE_MAX_CHARS).regex(NO_CONTROL, "no control characters").optional(),
});

export const reportResultSchema = z.object({
  targetKind: z.enum(["post", "profile"]),
  targetId: z.string(),
  /** Always true: a repeat report by the same account is idempotent. */
  reported: z.literal(true),
});

export const postCreateRoute = defineRoute({
  method: "POST",
  path: "/v1/posts",
  auth: "session",
  params: undefined,
  query: undefined,
  body: postCreateSchema,
  response: postSchema,
  status: 201,
});

/** A thesis (or a reply's thesis context) with its replies. 404 when hidden, deleted or its author isn't listed. */
export const threadRoute = defineRoute({
  method: "GET",
  path: "/v1/posts/:id",
  auth: "optional",
  params: postParamsSchema,
  query: threadQuerySchema,
  body: undefined,
  response: threadSchema,
});

/** The author deletes their own post (a thesis takes its replies and likes with it). */
export const postDeleteRoute = defineRoute({
  method: "DELETE",
  path: "/v1/posts/:id",
  auth: "session",
  params: postParamsSchema,
  query: undefined,
  body: undefined,
  response: deletedResponseSchema,
});

export const likeRoute = defineRoute({
  method: "POST",
  path: "/v1/posts/:id/like",
  auth: "session",
  params: postParamsSchema,
  query: undefined,
  body: undefined,
  response: likeStateSchema,
});

export const unlikeRoute = defineRoute({
  method: "DELETE",
  path: "/v1/posts/:id/like",
  auth: "session",
  params: postParamsSchema,
  query: undefined,
  body: undefined,
  response: likeStateSchema,
});

export const postReportRoute = defineRoute({
  method: "POST",
  path: "/v1/posts/:id/report",
  auth: "session",
  params: postParamsSchema,
  query: undefined,
  body: reportRequestSchema,
  response: reportResultSchema,
});

export type SocialIdentity = z.output<typeof socialIdentitySchema>;
export type Post = z.output<typeof postSchema>;
export type PostCreate = z.output<typeof postCreateSchema>;
export type Thread = z.output<typeof threadSchema>;
export type LikeState = z.output<typeof likeStateSchema>;
export type ReportRequest = z.output<typeof reportRequestSchema>;
export type ReportResult = z.output<typeof reportResultSchema>;
export type ReportReason = (typeof REPORT_REASONS)[number];
