import { randomUUID } from "node:crypto";
import {
  type Alert,
  alertsCreateRoute,
  alertsDeleteRoute,
  alertsListRoute,
  DEVICE_HASH_MAX_CHARS,
  DEVICE_HEADER,
  eventsRoute,
  PUSH_CHANNEL_DEFAULTS,
  PUSH_CHANNELS,
  type PushChannel,
  pushTokenDeleteRoute,
  pushTokenRoute,
} from "@senryo/api-client";
import { HTTP_STATUS, HttpError, type HttpServer, parseRoute, type Session, sendRoute } from "@senryo/service-common";
import type { FastifyRequest } from "fastify";
import { EVENT_CLOCK_SKEW_MS, EVENT_PROPS_MAX_CHARS } from "../constants.ts";
import type { ApiContext } from "../context.ts";

/** Active alerts per account per network (C9: 50 Practice alerts never block a Mainnet one). */
const ALERTS_PER_MODE_MAX = 50;
const EVENTS_RATE = { max: 60, timeWindow: "1 minute" } as const;

interface AlertRow {
  id: string;
  chain_id: number;
  market_id: number;
  direction: "above" | "below";
  price18: string;
  status: "active" | "triggered" | "cancelled";
  created_at: Date;
  triggered_at: Date | null;
}

function alertOf(row: AlertRow): Alert {
  return {
    id: row.id,
    chainId: row.chain_id as Alert["chainId"],
    marketId: row.market_id,
    direction: row.direction,
    price18: BigInt(row.price18),
    status: row.status,
    createdAt: row.created_at.toISOString(),
    triggeredAt: row.triggered_at?.toISOString() ?? null,
  };
}

/** Price alerts (evaluated by the keeper), first-party analytics, push-token registration. */
export function registerEngagementRoutes(app: HttpServer, ctx: ApiContext): void {
  const session = async (request: FastifyRequest): Promise<Session> => {
    if (!ctx.sessions) throw new HttpError(HTTP_STATUS.unavailable, "NOT_DEPLOYED", "sessions not configured");
    return ctx.sessions.require(request);
  };

  app.get(alertsListRoute.path, async (request, reply) => {
    const s = await session(request);
    // Sessions are per chain (S8.22): a Practice session lists Practice alerts only.
    const rows = await ctx.db<AlertRow[]>`SELECT * FROM price_alerts WHERE user_address = ${s.address.toLowerCase()}
                                          AND chain_id = ${s.chainId} AND status <> 'cancelled' ORDER BY created_at DESC`;
    return sendRoute(reply, alertsListRoute, { alerts: rows.map(alertOf) });
  });

  app.post(alertsCreateRoute.path, async (request, reply) => {
    const s = await session(request);
    const { body } = parseRoute(alertsCreateRoute, request);
    if (body.chainId !== s.chainId) {
      throw new HttpError(HTTP_STATUS.forbidden, "FORBIDDEN", "this session belongs to the other network");
    }
    const user = s.address.toLowerCase();
    // One transaction: an edit cancels the alert it replaces and stores the new one together, or neither.
    const row = await ctx.db.begin(async (tx) => {
      // One writer per account and network: two parallel creates can't both pass the cap.
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${`alerts:${user}:${s.chainId}`}, 0))`;
      if (body.replaces) {
        const [replaced] = await tx<{ id: string }[]>`UPDATE price_alerts SET status = 'cancelled'
                                     WHERE id = ${body.replaces} AND user_address = ${user} AND chain_id = ${s.chainId}
                                       AND status <> 'cancelled' RETURNING id`;
        if (!replaced) throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", "no such alert");
      }
      const [count] = await tx<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM price_alerts
                                     WHERE user_address = ${user} AND chain_id = ${s.chainId} AND status = 'active'`;
      if ((count?.n ?? 0n) >= BigInt(ALERTS_PER_MODE_MAX))
        throw new HttpError(HTTP_STATUS.conflict, "CONFLICT", "too many alerts");
      const [stored] = await tx<AlertRow[]>`
        INSERT INTO price_alerts (id, user_address, chain_id, market_id, direction, price18)
        VALUES (${randomUUID()}, ${user}, ${body.chainId}, ${body.marketId}, ${body.direction}, ${body.price18.toString()})
        RETURNING *`;
      return stored;
    });
    if (!row) throw new HttpError(HTTP_STATUS.internal, "INTERNAL", "alert not stored");
    return sendRoute(reply, alertsCreateRoute, alertOf(row));
  });

  app.delete(alertsDeleteRoute.path, async (request, reply) => {
    const s = await session(request);
    const { params } = parseRoute(alertsDeleteRoute, request);
    const [row] = await ctx.db<AlertRow[]>`UPDATE price_alerts SET status = 'cancelled'
                                           WHERE id = ${params.id} AND user_address = ${s.address.toLowerCase()}
                                             AND chain_id = ${s.chainId} RETURNING *`;
    if (!row) throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", "no such alert");
    return sendRoute(reply, alertsDeleteRoute, alertOf(row));
  });

  app.post(eventsRoute.path, { config: { rateLimit: EVENTS_RATE } }, async (request, reply) => {
    const { body } = parseRoute(eventsRoute, request);
    const session =
      request.headers.authorization && ctx.sessions
        ? await ctx.sessions.verify(request.headers.authorization.replace(/^Bearer /, ""))
        : undefined;
    const rawDevice = request.headers[DEVICE_HEADER];
    const deviceRaw = Array.isArray(rawDevice) ? rawDevice[0] : rawDevice;
    const device = deviceRaw && deviceRaw.length <= DEVICE_HASH_MAX_CHARS ? deviceRaw : null;
    const now = Date.now();
    // Analytics hygiene (S8.5b #13): client time clamped to ±1 day, oversized props dropped, device header capped.
    const rows = body.events.map((e) => {
      const at = Math.min(Math.max(new Date(e.at).getTime(), now - EVENT_CLOCK_SKEW_MS), now + EVENT_CLOCK_SKEW_MS);
      const props = e.props ?? {};
      return {
        name: e.name,
        user_address: session?.address.toLowerCase() ?? null,
        device_hash: device,
        platform: body.platform,
        app_version: body.appVersion,
        props: ctx.db.json((JSON.stringify(props).length <= EVENT_PROPS_MAX_CHARS ? props : {}) as never),
        created_at: new Date(Number.isFinite(at) ? at : now),
      };
    });
    await ctx.db`INSERT INTO events ${ctx.db(rows, "name", "user_address", "device_hash", "platform", "app_version", "props", "created_at")}`;
    return sendRoute(reply, eventsRoute, { accepted: rows.length });
  });

  app.put(pushTokenRoute.path, async (request, reply) => {
    const s = await session(request);
    const { body } = parseRoute(pushTokenRoute, request);
    // A channel the app didn't send takes its default (older builds don't know the social ones).
    const ch = Object.fromEntries(
      PUSH_CHANNELS.map((c) => [c, body.channels[c] ?? PUSH_CHANNEL_DEFAULTS[c]]),
    ) as Record<PushChannel, boolean>;
    // Re-binding on conflict is intended: one phone, several accounts share an Expo token (S8.5b #10, accepted —
    // tokens aren't public and the worst case is a missed notification).
    await ctx.db`
      INSERT INTO push_tokens (token, user_address, platform, kind, ch_fills, ch_liquidation, ch_deposits, ch_card,
                               ch_price_alerts, ch_social, ch_followed_trades)
      VALUES (${body.token}, ${s.address.toLowerCase()}, ${body.platform}, ${body.kind}, ${ch.fills},
              ${ch.liquidation}, ${ch.deposits}, ${ch.card}, ${ch.priceAlerts}, ${ch.social}, ${ch.followedTrades})
      ON CONFLICT (token) DO UPDATE SET user_address = EXCLUDED.user_address, platform = EXCLUDED.platform,
        kind = EXCLUDED.kind, ch_fills = EXCLUDED.ch_fills, ch_liquidation = EXCLUDED.ch_liquidation,
        ch_deposits = EXCLUDED.ch_deposits, ch_card = EXCLUDED.ch_card, ch_price_alerts = EXCLUDED.ch_price_alerts,
        ch_social = EXCLUDED.ch_social, ch_followed_trades = EXCLUDED.ch_followed_trades,
        disabled_at = NULL, updated_at = now()`;
    return sendRoute(reply, pushTokenRoute, { token: body.token, channels: ch });
  });

  app.post(pushTokenDeleteRoute.path, async (request, reply) => {
    const s = await session(request);
    const { body } = parseRoute(pushTokenDeleteRoute, request);
    const deleted = await ctx.db`UPDATE push_tokens SET disabled_at = now() WHERE token = ${body.token}
                                 AND user_address = ${s.address.toLowerCase()} RETURNING token`;
    return sendRoute(reply, pushTokenDeleteRoute, { deleted: deleted.length > 0 });
  });
}
