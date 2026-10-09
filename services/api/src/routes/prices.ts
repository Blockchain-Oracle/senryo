import { candlesRoute, printRoute, recentPricesRoute } from "@senryo/api-client";
import { feedIdOf } from "@senryo/config";
import type { HttpServer } from "@senryo/service-common";
import { HTTP_STATUS, HttpError, nowSec, parseRoute, SECONDS_PER_DAY, sendRoute } from "@senryo/service-common";
import type { PythGateway } from "../prices/gateway.ts";
import { toE8 } from "../prices/ring.ts";

/**
 * Prices for first paint and history (D-272): `recent` from the gateway's ring (one point a second, short CDN cache),
 * `candles` from the 1-minute table (a closed range is immutable), `print` the archived unique print of an instant.
 * Live ticks only ever travel on `/v1/stream`. Display values only — never the raw Pyth payload (Starter: no
 * redistribution).
 */
const RECENT_MAX_AGE = "public, max-age=1, stale-while-revalidate=5";
const IMMUTABLE = "public, max-age=31536000, immutable";
const MAX_CANDLE_SPAN_DAYS = 7;
const MAX_CANDLE_SPAN_SEC = MAX_CANDLE_SPAN_DAYS * SECONDS_PER_DAY;
const MINUTE = 60;

export function registerPriceRoutes(app: HttpServer, gateway: PythGateway): void {
  app.get(recentPricesRoute.path, async (request, reply) => {
    const { query } = parseRoute(recentPricesRoute, request);
    const symbols = [...new Set(query.symbols.split(","))];
    reply.header("cache-control", RECENT_MAX_AGE);
    return sendRoute(reply, recentPricesRoute, {
      serverTime: Date.now(),
      feeds: symbols.flatMap((symbol) => {
        const feed = gateway.feedOf(symbol);
        return feed ? [{ symbol, points: feed.ring.recent() }] : [];
      }),
    });
  });

  app.get(candlesRoute.path, async (request, reply) => {
    const { query } = parseRoute(candlesRoute, request);
    const feed = gateway.feedOf(query.symbol);
    if (!feed) throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", `no market ${query.symbol}`);
    if (query.to < query.from || query.to - query.from > MAX_CANDLE_SPAN_SEC) {
      throw new HttpError(HTTP_STATUS.badRequest, "BAD_REQUEST", "range must be within 7 days");
    }
    const rows = await gateway.candles(feedIdOf(feed.market), query.from, query.to);
    const nowMinute = Math.floor(nowSec() / MINUTE) * MINUTE;
    if (query.to < nowMinute) reply.header("cache-control", IMMUTABLE);
    return sendRoute(reply, candlesRoute, {
      symbol: query.symbol,
      candles: rows.map((r): [number, number, number, number, number] => [
        Number(r.minute),
        Number(r.open),
        Number(r.high),
        Number(r.low),
        Number(r.close),
      ]),
    });
  });

  app.get(printRoute.path, async (request, reply) => {
    const { query } = parseRoute(printRoute, request);
    const feed = gateway.feedOf(query.symbol);
    if (!feed) throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", `no market ${query.symbol}`);
    if (query.t > nowSec()) throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", "that instant is ahead");
    const u = await gateway.printAt(feedIdOf(feed.market), query.t, 0);
    if (!u) throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", "no print for that instant");
    reply.header("cache-control", IMMUTABLE);
    return sendRoute(reply, printRoute, {
      symbol: query.symbol,
      t: query.t,
      priceE8: Number(toE8(u.price, u.expo)),
      confE8: Number(toE8(u.conf, u.expo)),
      publishTime: u.publishTime,
      prevPublishTime: u.prevPublishTime,
    });
  });
}
