import { candlesRoute, dayPricesRoute, latestPricesRoute, printRoute, recentPricesRoute } from "@senryo/api-client";
import { feedIdOf, MARKETS, marketByFeedId } from "@senryo/config";
import type { HttpServer } from "@senryo/service-common";
import { HTTP_STATUS, HttpError, nowSec, parseRoute, SECONDS_PER_DAY, sendRoute } from "@senryo/service-common";
import type { PythGateway } from "../prices/gateway.ts";
import { toE8 } from "../prices/ring.ts";

/**
 * Prices for first paint and history (D-272): `recent` from the gateway's ring (one point a second, short CDN cache),
 * `candles` from the 1-minute table (a closed range is immutable), `print` the archived unique print of an instant.
 * Live ticks only ever travel on `/v1/stream`. Display values only — never the raw Pyth payload (Starter: no
 * redistribution). Unauthenticated reads are rate-limited per client IP; `print` and `recent` never reach upstream
 * (04-pricing R4: an anonymous loop once could, F5).
 */
const RECENT_MAX_AGE = "public, max-age=1, stale-while-revalidate=5";
/** It carries the server time and the states: never from a cache. */
const NO_STORE = "no-store";
/** The 24 h numbers move slowly: read from the archive at most once a minute, and cached as long. */
const DAY_TTL_MS = 60_000;
const DAY_MAX_AGE = "public, max-age=60";
const DAY_SEC = SECONDS_PER_DAY;
const IMMUTABLE = "public, max-age=31536000, immutable";
/** A missing print may exist a second later; the apps retry every second (`use-window-open`), so never longer. */
const MISS_MAX_AGE = "public, max-age=1";
/** Per client IP: a terminal's open-print retries (10 a window) plus Proof and first paint, with room to spare. */
const PRICE_READ_RATE = { rateLimit: { max: 120, timeWindow: "1 minute" } } as const;
/** No request names more symbols than the catalogue has. */
const MAX_RECENT_SYMBOLS = MARKETS.length;
const MAX_CANDLE_SPAN_DAYS = 7;
const MAX_CANDLE_SPAN_SEC = MAX_CANDLE_SPAN_DAYS * SECONDS_PER_DAY;
const MINUTE = 60;

export function registerPriceRoutes(app: HttpServer, gateway: PythGateway): void {
  type Day = Record<string, { openE8: number; highE8: number; lowE8: number }>;
  let day: { at: number; body: Promise<{ from: number; markets: Day }> } | null = null;
  const readDay = async (from: number): Promise<Day> =>
    Object.fromEntries(
      (await gateway.daySince(from)).flatMap((r) => {
        const symbol = marketByFeedId(r.feed_id)?.symbol;
        return symbol ? [[symbol, { openE8: Number(r.open), highE8: Number(r.high), lowE8: Number(r.low) }]] : [];
      }),
    );
  app.get(dayPricesRoute.path, { config: PRICE_READ_RATE }, async (_request, reply) => {
    const now = Date.now();
    if (!day || now - day.at > DAY_TTL_MS) {
      const from = Math.floor(nowSec() / MINUTE) * MINUTE - DAY_SEC;
      day = { at: now, body: readDay(from).then((markets) => ({ from, markets })) };
      // A failed read is not kept: the next request tries again.
      day.body.catch(() => {
        day = null;
      });
    }
    reply.header("cache-control", DAY_MAX_AGE);
    return sendRoute(reply, dayPricesRoute, await day.body);
  });

  app.get(recentPricesRoute.path, { config: PRICE_READ_RATE }, async (request, reply) => {
    const { query } = parseRoute(recentPricesRoute, request);
    const symbols = [...new Set(query.symbols.split(",", MAX_RECENT_SYMBOLS))];
    reply.header("cache-control", RECENT_MAX_AGE);
    return sendRoute(reply, recentPricesRoute, {
      serverTime: Date.now(),
      feeds: symbols.flatMap((symbol) => {
        const feed = gateway.feedOf(symbol);
        return feed ? [{ symbol, points: feed.ring.recent() }] : [];
      }),
    });
  });

  app.get(latestPricesRoute.path, { config: PRICE_READ_RATE }, async (_request, reply) => {
    reply.header("cache-control", NO_STORE);
    return sendRoute(reply, latestPricesRoute, {
      serverTime: Date.now(),
      states: gateway.healthDigest(),
      points: gateway.latestTicks().map((t): [number, number, number] => [t[0], t[1], t[2]]),
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

  app.get(printRoute.path, { config: PRICE_READ_RATE }, async (request, reply) => {
    const { query } = parseRoute(printRoute, request);
    const feed = gateway.feedOf(query.symbol);
    if (!feed) throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", `no market ${query.symbol}`);
    if (query.t > nowSec()) throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", "that instant is ahead");
    const u = await gateway.knownPrintAt(feedIdOf(feed.market), query.t);
    if (!u) {
      reply.header("cache-control", MISS_MAX_AGE);
      throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", "no print for that instant");
    }
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
