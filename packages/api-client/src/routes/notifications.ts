import * as z from "zod";
import { MARKET_ID_PATTERN } from "../handles.ts";
import { addressSchema, chainIdSchema, isoTimeSchema } from "../primitives.ts";
import { defineRoute } from "./define.ts";
import { PUSH_CHANNELS } from "./engagement.ts";

/**
 * Notifications inbox (G1, D7): every push the account was sent on one network — call results, money arrived,
 * price alerts, social — newest first, from the server's push ledger (kept 30 days). Session routes:
 * a session lists and marks its own network only (S8.22). Each response carries the unread count for the bell badge.
 */

export const NOTIFICATIONS_PAGE_DEFAULT = 30;
export const NOTIFICATIONS_PAGE_MAX = 100;
/** Ids one `POST /v1/notifications/read` may name (mark-all uses `before`). */
export const NOTIFICATIONS_READ_IDS_MAX = 100;
/** Ids are the push ledger's event keys (`<chainId>:<event>`), printable ASCII. */
const NOTIFICATION_ID_MAX_CHARS = 512;
const NOTIFICATION_ID = /^[\x21-\x7e]+$/;
/** `<sent_at in µs>:<id>` — a keyset on (time, id), newest first. */
const NOTIFICATION_CURSOR = /^\d{1,20}:[\x21-\x7e]{1,512}$/;
const SYMBOL_MAX_CHARS = 32;
const marketIdSchema = z.string().regex(MARKET_ID_PATTERN);

export const notificationIdSchema = z.string().max(NOTIFICATION_ID_MAX_CHARS).regex(NOTIFICATION_ID);
export const notificationCursorSchema = z.string().regex(NOTIFICATION_CURSOR, "expected a notifications cursor");

/**
 * What the row is about, so the app draws its mark: a market (catalogue id, `BTC`), a token (by address, never
 * symbol), a person (avatar; `marketId` when it's about their call), or the account as a whole (dollars credited).
 */
export const notificationSubjectSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("market"), marketId: marketIdSchema }),
  z.object({
    kind: z.literal("token"),
    address: addressSchema,
    symbol: z.string().max(SYMBOL_MAX_CHARS).optional(),
  }),
  z.object({ kind: z.literal("person"), address: addressSchema, marketId: marketIdSchema.optional() }),
  z.object({ kind: z.literal("account") }),
]);

export const notificationSchema = z.object({
  id: notificationIdSchema,
  chainId: chainIdSchema,
  channel: z.enum(PUSH_CHANNELS),
  title: z.string(),
  body: z.string(),
  /** The `senryo://…?chainId=` screen a tap opens (the push's own link). */
  url: z.string().nullable(),
  subject: notificationSubjectSchema.nullable(),
  createdAt: isoTimeSchema,
  readAt: isoTimeSchema.nullable(),
});

export const notificationsQuerySchema = z.object({
  chainId: z.coerce.number().pipe(chainIdSchema),
  cursor: notificationCursorSchema.optional(),
  limit: z.coerce.number().int().positive().max(NOTIFICATIONS_PAGE_MAX).optional(),
});

export const notificationPageSchema = z.object({
  items: z.array(notificationSchema),
  nextCursor: notificationCursorSchema.nullable(),
  /** Unread on this network (all pages), for the bell badge. */
  unread: z.int().nonnegative(),
});

/** Mark these ids read, or everything created at or before `before` (the newest row the user has seen). */
export const notificationsReadRequestSchema = z.union([
  z.strictObject({
    chainId: chainIdSchema,
    ids: z.array(notificationIdSchema).min(1).max(NOTIFICATIONS_READ_IDS_MAX),
  }),
  z.strictObject({ chainId: chainIdSchema, before: isoTimeSchema }),
]);

export const notificationsReadResponseSchema = z.object({
  /** Rows this call turned read (already-read rows don't count). */
  updated: z.int().nonnegative(),
  unread: z.int().nonnegative(),
});

export const notificationsListRoute = defineRoute({
  method: "GET",
  path: "/v1/notifications",
  auth: "session",
  params: undefined,
  query: notificationsQuerySchema,
  body: undefined,
  response: notificationPageSchema,
});

export const notificationsReadRoute = defineRoute({
  method: "POST",
  path: "/v1/notifications/read",
  auth: "session",
  params: undefined,
  query: undefined,
  body: notificationsReadRequestSchema,
  response: notificationsReadResponseSchema,
});

export type NotificationSubject = z.output<typeof notificationSubjectSchema>;
export type AppNotification = z.output<typeof notificationSchema>;
export type NotificationPage = z.output<typeof notificationPageSchema>;
export type NotificationsRead = z.input<typeof notificationsReadRequestSchema>;
export type NotificationsReadResult = z.output<typeof notificationsReadResponseSchema>;
