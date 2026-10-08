import {
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

const EVENTS_RATE = { max: 60, timeWindow: "1 minute" } as const;

/** First-party analytics and push-token registration. Market-open alerts return with S8. */
export function registerEngagementRoutes(app: HttpServer, ctx: ApiContext): void {
  const session = async (request: FastifyRequest): Promise<Session> => {
    if (!ctx.sessions) throw new HttpError(HTTP_STATUS.unavailable, "NOT_DEPLOYED", "sessions not configured");
    return ctx.sessions.require(request);
  };

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
      INSERT INTO push_tokens (token, user_address, platform, kind, ch_results, ch_deposits, ch_price_alerts, ch_social)
      VALUES (${body.token}, ${s.address.toLowerCase()}, ${body.platform}, ${body.kind}, ${ch.results},
              ${ch.deposits}, ${ch.priceAlerts}, ${ch.social})
      ON CONFLICT (token) DO UPDATE SET user_address = EXCLUDED.user_address, platform = EXCLUDED.platform,
        kind = EXCLUDED.kind, ch_results = EXCLUDED.ch_results, ch_deposits = EXCLUDED.ch_deposits,
        ch_price_alerts = EXCLUDED.ch_price_alerts, ch_social = EXCLUDED.ch_social,
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
