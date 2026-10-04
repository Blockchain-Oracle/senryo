import { z } from "zod";
import { addressSchema, isoTimeSchema } from "../primitives.ts";
import { FOLLOW_PAGE_MAX, HANDLE_MAX_CHARS } from "../social.ts";
import { defineRoute } from "./define.ts";
import { avatarIdSchema, chainQuerySchema } from "./profile.ts";

/**
 * Follows (S12b.3, D-174). A follow is account-level (one address on both networks); lists and counts show only
 * accounts listed on the queried network. Following is not copy trading. Writes need a session; a block in either
 * direction answers 403 BLOCKED; an account follows at most `FOLLOWING_MAX` others (409 FOLLOW_LIMIT).
 * Only accounts listed on at least one network can be followed (404 otherwise).
 */

/** Page cursors are `follows.id` values; 18 digits keep any cursor inside Postgres bigint (no 500 on garbage). */
const CURSOR_MAX_DIGITS = 18;
const CURSOR_RE = new RegExp(`^\\d{1,${CURSOR_MAX_DIGITS}}$`);

export const followParamsSchema = z.object({ address: addressSchema });

/** The session account's relationship with `address` (`followsYou` only when `address` is listed on the session's network). */
export const followStateSchema = z.object({
  address: addressSchema,
  following: z.boolean(),
  followsYou: z.boolean(),
  /** A block in either direction. */
  blocked: z.boolean(),
});

export const followListQuerySchema = chainQuerySchema.extend({
  /** `nextCursor` of the previous page. */
  cursor: z.string().regex(CURSOR_RE, "expected a page cursor").optional(),
  limit: z.coerce.number().int().positive().max(FOLLOW_PAGE_MAX).optional(),
});

export const followEntrySchema = z.object({
  address: addressSchema,
  handle: z.string().max(HANDLE_MAX_CHARS).nullable(),
  displayName: z.string().nullable(),
  avatar: avatarIdSchema.nullable(),
  followedAt: isoTimeSchema,
});

export const followPageSchema = z.object({
  items: z.array(followEntrySchema),
  /** Pass back as `cursor` for the next page; null at the end. */
  nextCursor: z.string().regex(CURSOR_RE).nullable(),
});

export const followGetRoute = defineRoute({
  method: "GET",
  path: "/v1/follow/:address",
  auth: "session",
  params: followParamsSchema,
  query: undefined,
  body: undefined,
  response: followStateSchema,
});

export const followRoute = defineRoute({
  method: "POST",
  path: "/v1/follow/:address",
  auth: "session",
  params: followParamsSchema,
  query: undefined,
  body: undefined,
  response: followStateSchema,
});

export const unfollowRoute = defineRoute({
  method: "DELETE",
  path: "/v1/follow/:address",
  auth: "session",
  params: followParamsSchema,
  query: undefined,
  body: undefined,
  response: followStateSchema,
});

/** Accounts following `address`, newest first. 404 when `address` isn't listed on `chainId`. */
export const followersRoute = defineRoute({
  method: "GET",
  path: "/v1/followers/:address",
  auth: "none",
  params: followParamsSchema,
  query: followListQuerySchema,
  body: undefined,
  response: followPageSchema,
});

/** Accounts `address` follows, newest first. 404 when `address` isn't listed on `chainId`. */
export const followingRoute = defineRoute({
  method: "GET",
  path: "/v1/following/:address",
  auth: "none",
  params: followParamsSchema,
  query: followListQuerySchema,
  body: undefined,
  response: followPageSchema,
});

export type FollowState = z.output<typeof followStateSchema>;
export type FollowEntry = z.output<typeof followEntrySchema>;
export type FollowPage = z.output<typeof followPageSchema>;

/** Your own lists remain readable without publishing your profile. Other people remain network-filtered. */
export const myFollowListRoute = defineRoute({
  method: "GET",
  path: "/v1/me/follows/:direction",
  auth: "session",
  params: z.object({ direction: z.enum(["followers", "following"]) }),
  query: followListQuerySchema,
  body: undefined,
  response: followPageSchema,
});

export const myFollowCountsRoute = defineRoute({
  method: "GET",
  path: "/v1/me/follow-counts",
  auth: "session",
  params: undefined,
  query: chainQuerySchema,
  body: undefined,
  response: z.object({ followers: z.int().nonnegative(), following: z.int().nonnegative() }),
});
