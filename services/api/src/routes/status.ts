/**
 * The Status board over HTTP (P6, D-324): `/v1/status/history` folds the per-minute record into 24 hourly or 90 daily
 * buckets per component — minutes recorded, minutes healthy, the worst state seen — in SQL; a bucket nobody recorded
 * is null (grey on the board, never a pass). Scheduled closures aren't downtime: a closed market counts for nothing in
 * the prices component's state.
 */
import { STATUS_COMPONENTS, statusHistoryRoute } from "@senryo/api-client";
import { type HttpServer, MS_PER_SECOND, parseRoute, sendRoute } from "@senryo/service-common";
import type { ApiContext } from "../context.ts";
import { HISTORY_RANGES, SECONDS_PER_MINUTE } from "../status/constants.ts";

const READ_RATE = { rateLimit: { max: 60, timeWindow: "1 minute" } } as const;
const WORST = ["ok", "unknown", "degraded", "down"] as const;
const HISTORY_MAX_AGE = "public, max-age=30";

export function registerStatusRoutes(app: HttpServer, ctx: ApiContext): void {
  app.get(statusHistoryRoute.path, { config: READ_RATE }, async (request, reply) => {
    const { query } = parseRoute(statusHistoryRoute, request);
    const range = HISTORY_RANGES[query.range];
    const nowMinute = Math.floor(Date.now() / MS_PER_SECOND / SECONDS_PER_MINUTE);
    const last = Math.floor(nowMinute / range.minutes);
    const first = last - range.buckets + 1;
    const rows = await ctx.db<{ b: number; id: string; seen: number; ok: number; worst: number }[]>`
      SELECT (minute / ${range.minutes})::int8 AS b, c->>'id' AS id, count(*)::int AS seen,
             count(*) FILTER (WHERE c->>'state' = 'ok')::int AS ok,
             max(CASE c->>'state' WHEN 'down' THEN 3 WHEN 'degraded' THEN 2 WHEN 'unknown' THEN 1 ELSE 0 END)::int AS worst
      FROM health_minutes, jsonb_array_elements(payload->'components') AS c
      WHERE chain_id = ${query.chainId} AND minute >= ${first * range.minutes}
      GROUP BY 1, 2`;
    const components = STATUS_COMPONENTS.map((id) => ({
      id,
      buckets: Array.from({ length: range.buckets }, (_, i) => {
        const r = rows.find((x) => x.id === id && Number(x.b) === first + i);
        return r ? { seen: r.seen, ok: r.ok, worst: WORST[r.worst] ?? "unknown" } : null;
      }),
    }));
    reply.header("cache-control", HISTORY_MAX_AGE);
    return sendRoute(reply, statusHistoryRoute, {
      range: query.range,
      from: first * range.minutes * SECONDS_PER_MINUTE,
      bucketSec: range.minutes * SECONDS_PER_MINUTE,
      components,
    });
  });
}
