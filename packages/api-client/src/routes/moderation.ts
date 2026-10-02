import { z } from "zod";
import { addressSchema, isoTimeSchema } from "../primitives.ts";
import { BLOCK_PAGE_MAX, REPORT_NOTE_MAX_CHARS, REPORT_REASONS } from "../social.ts";
import { defineRoute } from "./define.ts";
import { reportRequestSchema, reportResultSchema, socialIdentitySchema } from "./posts.ts";

/**
 * User safety (S12b.6, App Store 1.2): block, mute, report a profile, "delete my data" for the social layer, and the
 * operator's review queue.
 * - Block: either side's follows are removed, and neither side can follow, reply to or like the other; the feed hides
 *   both ways. Mute: only hides the muted account from your feed. Both are private to you.
 * - Delete my data (S12b.8): profile, follows both ways, your blocks and mutes, your posts (with their replies and
 *   likes), your likes, your reports and your feed rows. Kept: the released handle's 30-day hold (Q-022 default:
 *   no impersonation by instant re-claim), other people's blocks/mutes of you, and moderation decisions.
 */

/** A post uuid (36) or an address (42). */
const TARGET_ID_MAX_CHARS = 64;

export const relationParamsSchema = z.object({ address: addressSchema });

export const blockStateSchema = z.object({ address: addressSchema, blocked: z.boolean() });
export const muteStateSchema = z.object({ address: addressSchema, muted: z.boolean() });

/** Handle / name / avatar appear only while the account is listed on the session's network. */
export const relationEntrySchema = socialIdentitySchema.extend({ since: isoTimeSchema });
export const relationListSchema = z.object({ items: z.array(relationEntrySchema) });
const relationListQuery = z.object({ limit: z.coerce.number().int().positive().max(BLOCK_PAGE_MAX).optional() });

export const blockRoute = defineRoute({
  method: "POST",
  path: "/v1/blocks/:address",
  auth: "session",
  params: relationParamsSchema,
  query: undefined,
  body: undefined,
  response: blockStateSchema,
});

export const unblockRoute = defineRoute({
  method: "DELETE",
  path: "/v1/blocks/:address",
  auth: "session",
  params: relationParamsSchema,
  query: undefined,
  body: undefined,
  response: blockStateSchema,
});

export const blocksRoute = defineRoute({
  method: "GET",
  path: "/v1/blocks",
  auth: "session",
  params: undefined,
  query: relationListQuery,
  body: undefined,
  response: relationListSchema,
});

export const muteRoute = defineRoute({
  method: "POST",
  path: "/v1/mutes/:address",
  auth: "session",
  params: relationParamsSchema,
  query: undefined,
  body: undefined,
  response: muteStateSchema,
});

export const unmuteRoute = defineRoute({
  method: "DELETE",
  path: "/v1/mutes/:address",
  auth: "session",
  params: relationParamsSchema,
  query: undefined,
  body: undefined,
  response: muteStateSchema,
});

export const mutesRoute = defineRoute({
  method: "GET",
  path: "/v1/mutes",
  auth: "session",
  params: undefined,
  query: relationListQuery,
  body: undefined,
  response: relationListSchema,
});

/** Report a profile (any account; reports on unlisted ones still reach the queue). */
export const profileReportRoute = defineRoute({
  method: "POST",
  path: "/v1/profile/:address/report",
  auth: "session",
  params: relationParamsSchema,
  query: undefined,
  body: reportRequestSchema,
  response: reportResultSchema,
});

export const socialDeleteSchema = z.object({
  deleted: z.object({
    profile: z.boolean(),
    follows: z.int().nonnegative(),
    blocks: z.int().nonnegative(),
    mutes: z.int().nonnegative(),
    posts: z.int().nonnegative(),
    likes: z.int().nonnegative(),
    reports: z.int().nonnegative(),
    feedEvents: z.int().nonnegative(),
    /** A9 / defect 10 — defaulted so an api from before them still parses. */
    alerts: z.int().nonnegative().default(0),
    pushTokens: z.int().nonnegative().default(0),
    vaults: z.int().nonnegative().default(0),
    inboxWatches: z.int().nonnegative().default(0),
    prefs: z.boolean().default(false),
    notifications: z.int().nonnegative().default(0),
  }),
  /** The released handle stays held this long (Q-022 default); null when there was no handle. */
  handleHeldUntil: isoTimeSchema.nullable(),
});

export const socialDeleteRoute = defineRoute({
  method: "DELETE",
  path: "/v1/social",
  auth: "session",
  params: undefined,
  query: undefined,
  body: undefined,
  response: socialDeleteSchema,
});

// ---------------------------------------------------------------- operator review (auth: admin)

export const REVIEW_DECISIONS = ["hide", "keep"] as const;
export const REPORT_TARGET_KINDS = ["post", "profile"] as const;

export const reviewQueueQuerySchema = z.object({
  /** `queued` = weighted reports at the review bar and not hidden; `open` = any open report. */
  status: z.enum(["queued", "open"]).default("queued"),
});

export const reviewQueueItemSchema = z.object({
  targetKind: z.enum(REPORT_TARGET_KINDS),
  targetId: z.string(),
  /** Σ weight of open reports (claimed/funded reporters only). */
  weight: z.int().nonnegative(),
  reports: z.int().nonnegative(),
  reasons: z.partialRecord(z.enum(REPORT_REASONS), z.int().positive()),
  decision: z.enum(REVIEW_DECISIONS).nullable(),
  hidden: z.boolean(),
  /** Post text or `@handle · display name`, for the reviewer. */
  preview: z.string().nullable(),
  firstAt: isoTimeSchema,
  lastAt: isoTimeSchema,
});

export const reviewQueueSchema = z.object({ items: z.array(reviewQueueItemSchema) });

export const reviewRequestSchema = z.object({
  targetKind: z.enum(REPORT_TARGET_KINDS),
  targetId: z.string().min(1).max(TARGET_ID_MAX_CHARS),
  /** `hide` takes effect once the weighted reports reach the bar (immediately if they already do); `keep` dismisses. */
  decision: z.enum(REVIEW_DECISIONS),
  note: z.string().max(REPORT_NOTE_MAX_CHARS).optional(),
});

export const reviewResultSchema = z.object({
  targetKind: z.enum(REPORT_TARGET_KINDS),
  targetId: z.string(),
  decision: z.enum(REVIEW_DECISIONS),
  weight: z.int().nonnegative(),
  hidden: z.boolean(),
});

export const reviewQueueRoute = defineRoute({
  method: "GET",
  path: "/v1/admin/reports",
  auth: "admin",
  params: undefined,
  query: reviewQueueQuerySchema,
  body: undefined,
  response: reviewQueueSchema,
});

export const reviewRoute = defineRoute({
  method: "POST",
  path: "/v1/admin/reviews",
  auth: "admin",
  params: undefined,
  query: undefined,
  body: reviewRequestSchema,
  response: reviewResultSchema,
});

export type BlockState = z.output<typeof blockStateSchema>;
export type MuteState = z.output<typeof muteStateSchema>;
export type RelationEntry = z.output<typeof relationEntrySchema>;
export type SocialDelete = z.output<typeof socialDeleteSchema>;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];
export type ReportTargetKind = (typeof REPORT_TARGET_KINDS)[number];
export type ReviewQueueItem = z.output<typeof reviewQueueItemSchema>;
export type ReviewResult = z.output<typeof reviewResultSchema>;
