import { randomUUID } from "node:crypto";
import {
  type Alert,
  alertsCreateRoute,
  alertsDeleteRoute,
  alertsListRoute,
  DEVICE_HASH_MAX_CHARS,
  DEVICE_HEADER,
  eventsRoute,
  pushTokenDeleteRoute,
  pushTokenRoute,
} from "@senryo/api-client";
import { HTTP_STATUS, HttpError, type HttpServer, parseRoute, type Session, sendRoute } from "@senryo/service-common";
import type { FastifyRequest } from "fastify";
import { EVENT_CLOCK_SKEW_MS, EVENT_PROPS_MAX_CHARS } from "../constants.ts";
import type { ApiContext } from "../context.ts";

const ALERTS_PER_ACCOUNT_MAX = 50;
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
    const rows = await ctx.db<AlertRow[]>`SELECT * FROM price_alerts WHERE user_address = ${s.address.toLowerCase()}
                                          AND status <> 'cancelled' ORDER BY created_at DESC`;
    return sendRoute(reply, alertsListRoute, { alerts: rows.map(alertOf) });
  });

  app.post(alertsCreateRoute.path, async (request, reply) => {
    const s = await session(request);
    const { body } = parseRoute(alertsCreateRoute, request);
    const user = s.address.toLowerCase();
    const [count] = await ctx.db<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM price_alerts
                                                 WHERE user_address = ${user} AND status = 'active'`;
    if ((count?.n ?? 0n) >= BigInt(ALERTS_PER_ACCOUNT_MAX))
      throw new HttpError(HTTP_STATUS.conflict, "CONFLICT", "too many alerts");
    const [row] = await ctx.db<AlertRow[]>`
      INSERT INTO price_alerts (id, user_address, chain_id, market_id, direction, price18)
      VALUES (${randomUUID()}, ${user}, ${body.chainId}, ${body.marketId}, ${body.direction}, ${body.price18.toString()})
      RETURNING *`;
    if (!row) throw new HttpError(HTTP_STATUS.internal, "INTERNAL", "alert not stored");
    return sendRoute(reply, alertsCreateRoute, alertOf(row));
  });

  app.delete(alertsDeleteRoute.path, async (request, reply) => {
    const s = await session(request);
    const { params } = parseRoute(alertsDeleteRoute, request);
    const [row] = await ctx.db<AlertRow[]>`UPDATE price_alerts SET status = 'cancelled'
                                           WHERE id = ${params.id} AND user_address = ${s.address.toLowerCase()} RETURNING *`;
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
    const ch = body.channels;
    // Re-binding on conflict is intended: one phone, several accounts share an Expo token (S8.5b #10, accepted —
    // tokens aren't public and the worst case is a missed notification).
    await ctx.db`
      INSERT INTO push_tokens (token, user_address, platform, kind, ch_fills, ch_liquidation, ch_deposits, ch_card, ch_price_alerts)
      VALUES (${body.token}, ${s.address.toLowerCase()}, ${body.platform}, ${body.kind}, ${ch.fills ?? true},
              ${ch.liquidation ?? true}, ${ch.deposits ?? true}, ${ch.card ?? true}, ${ch.priceAlerts ?? true})
      ON CONFLICT (token) DO UPDATE SET user_address = EXCLUDED.user_address, platform = EXCLUDED.platform,
        kind = EXCLUDED.kind, ch_fills = EXCLUDED.ch_fills, ch_liquidation = EXCLUDED.ch_liquidation,
        ch_deposits = EXCLUDED.ch_deposits, ch_card = EXCLUDED.ch_card, ch_price_alerts = EXCLUDED.ch_price_alerts,
        disabled_at = NULL, updated_at = now()`;
    const channels = {
      fills: ch.fills ?? true,
      liquidation: ch.liquidation ?? true,
      deposits: ch.deposits ?? true,
      card: ch.card ?? true,
      priceAlerts: ch.priceAlerts ?? true,
    };
    return sendRoute(reply, pushTokenRoute, { token: body.token, channels });
  });

  app.post(pushTokenDeleteRoute.path, async (request, reply) => {
    const s = await session(request);
    const { body } = parseRoute(pushTokenDeleteRoute, request);
    const deleted = await ctx.db`UPDATE push_tokens SET disabled_at = now() WHERE token = ${body.token}
                                 AND user_address = ${s.address.toLowerCase()} RETURNING token`;
    return sendRoute(reply, pushTokenDeleteRoute, { deleted: deleted.length > 0 });
  });
}
