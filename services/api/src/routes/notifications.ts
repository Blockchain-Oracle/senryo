import {
  type AppNotification,
  NOTIFICATIONS_PAGE_DEFAULT,
  type NotificationSubject,
  notificationSubjectSchema,
  notificationsListRoute,
  notificationsReadRoute,
  PUSH_CHANNELS,
} from "@senryo/api-client";
import type { ChainId } from "@senryo/config";
import {
  type Db,
  followedTradeVisible,
  HTTP_STATUS,
  HttpError,
  type HttpServer,
  parseRoute,
  type Session,
  sendRoute,
} from "@senryo/service-common";
import type { FastifyRequest } from "fastify";
import type { SocialContext } from "../social/shared.ts";

const LIST_RATE = { max: 120, timeWindow: "1 minute" } as const;
const READ_RATE = { max: 60, timeWindow: "1 minute" } as const;

interface NotificationRow {
  event_key: string;
  chain_id: number;
  channel: AppNotification["channel"];
  title: string;
  body: string | null;
  url: string | null;
  subject: unknown;
  sent_at: Date;
  read_at: Date | null;
  at_us: string;
}

/** A stored subject the schema no longer accepts reads as none, never as a failed page. */
function subjectOf(raw: unknown): NotificationSubject | null {
  const parsed = notificationSubjectSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function notificationOf(row: NotificationRow): AppNotification {
  return {
    id: row.event_key,
    chainId: row.chain_id as ChainId,
    channel: row.channel,
    title: row.title,
    body: row.body ?? "",
    url: row.url,
    subject: subjectOf(row.subject),
    createdAt: row.sent_at.toISOString(),
    readAt: row.read_at?.toISOString() ?? null,
  };
}

/** `<µs>:<id>` → its parts (the id may itself contain `:`). */
function cursorParts(cursor: string): { micros: string; key: string } {
  const at = cursor.indexOf(":");
  return { micros: cursor.slice(0, at), key: cursor.slice(at + 1) };
}

/** The inbox rows of one account on one network: rows written before 0009 have no title and are left out. */
function inboxOf(db: Db, chainId: ChainId, user: string) {
  return db`chain_id = ${chainId} AND user_address = ${user} AND title IS NOT NULL AND channel IN ${db(PUSH_CHANNELS)}
    AND ${followedTradeVisible(db, chainId, "push_sends")}`;
}

async function unreadCount(db: Db, chainId: ChainId, user: string): Promise<number> {
  const [row] = await db<{ n: number }[]>`
    SELECT count(*)::int AS n FROM push_sends WHERE ${inboxOf(db, chainId, user)} AND read_at IS NULL`;
  return row?.n ?? 0;
}

/**
 * Notifications inbox (G1, D7): the push ledger read back, newest first, keyset on (time, id); mark read by ids or
 * "everything up to what I saw". Sessions are per network (S8.22): a session reads and marks its own network only.
 */
export function registerNotificationRoutes(app: HttpServer, ctx: SocialContext): void {
  const session = async (request: FastifyRequest, chainId: ChainId): Promise<Session> => {
    if (!ctx.sessions) throw new HttpError(HTTP_STATUS.unavailable, "NOT_DEPLOYED", "sessions not configured");
    const s = await ctx.sessions.require(request);
    if (s.chainId !== chainId) {
      throw new HttpError(HTTP_STATUS.forbidden, "FORBIDDEN", "this session belongs to the other network");
    }
    return s;
  };

  app.get(notificationsListRoute.path, { config: { rateLimit: LIST_RATE } }, async (request, reply) => {
    const { query } = parseRoute(notificationsListRoute, request);
    const user = (await session(request, query.chainId)).address.toLowerCase();
    const limit = query.limit ?? NOTIFICATIONS_PAGE_DEFAULT;
    // Whole microseconds, Postgres' own precision (no float rounding at the page edge).
    const micros = ctx.db`(extract(epoch FROM sent_at) * 1000000)::bigint`;
    const after = query.cursor ? cursorParts(query.cursor) : undefined;
    const rows = await ctx.db<NotificationRow[]>`
      SELECT event_key, chain_id, channel, title, body, url, subject, sent_at, read_at, ${micros}::text AS at_us
        FROM push_sends
       WHERE ${inboxOf(ctx.db, query.chainId, user)}
         ${after ? ctx.db`AND (${micros}, event_key) < (${after.micros}::bigint, ${after.key})` : ctx.db``}
       ORDER BY sent_at DESC, event_key DESC
       LIMIT ${limit + 1}`;
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return sendRoute(reply, notificationsListRoute, {
      items: page.map(notificationOf),
      nextCursor: rows.length > limit && last ? `${last.at_us}:${last.event_key}` : null,
      unread: await unreadCount(ctx.db, query.chainId, user),
    });
  });

  app.post(notificationsReadRoute.path, { config: { rateLimit: READ_RATE } }, async (request, reply) => {
    const { body } = parseRoute(notificationsReadRoute, request);
    const user = (await session(request, body.chainId)).address.toLowerCase();
    // `before` is a createdAt the app showed (milliseconds); rows are stored in microseconds.
    const which =
      "ids" in body
        ? ctx.db`event_key IN ${ctx.db(body.ids)}`
        : ctx.db`date_trunc('milliseconds', sent_at) <= ${new Date(body.before)}`;
    const updated = await ctx.db`
      UPDATE push_sends SET read_at = now()
       WHERE ${inboxOf(ctx.db, body.chainId, user)} AND read_at IS NULL AND ${which}`;
    return sendRoute(reply, notificationsReadRoute, {
      updated: updated.count,
      unread: await unreadCount(ctx.db, body.chainId, user),
    });
  });
}
