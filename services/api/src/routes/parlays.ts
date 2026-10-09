import { parlaysRoute, submitParlayRoute } from "@senryo/api-client";
import { type Hex, seriesOf } from "@senryo/chain";
import type { HttpServer } from "@senryo/service-common";
import { HTTP_STATUS, HttpError, parlaysOf, parseRoute, sendRoute } from "@senryo/service-common";
import type { ApiContext } from "../context.ts";
import { TICKETS_PAGE } from "../relay/constants.ts";

/** Parlays over HTTP (S8.5, D-293): a signed parlay relayed gas-free, and the caller's parlays with their legs. */
const PARLAYS_PER_MINUTE = 30;
const MINUTE_MS = 60_000;

export function registerParlayRoutes(app: HttpServer, ctx: ApiContext): void {
  app.post(
    submitParlayRoute.path,
    { config: { rateLimit: { max: PARLAYS_PER_MINUTE, timeWindow: MINUTE_MS } } },
    async (request, reply) => {
      const { body } = parseRoute(submitParlayRoute, request);
      const m = ctx.markets.get(body.chainId);
      if (!m) throw new HttpError(HTTP_STATUS.unavailable, "NOT_DEPLOYED", `markets are not live on ${body.chainId}`);
      const status = await m.parlays.submit({
        ...body,
        intent: { ...body.intent, windowIds: body.intent.windowIds as Hex[] },
        signature: body.signature as Hex,
      });
      return sendRoute(reply, submitParlayRoute, status);
    },
  );

  app.get(parlaysRoute.path, async (request, reply) => {
    const { query } = parseRoute(parlaysRoute, request);
    const rows = await parlaysOf(ctx.db, query.chainId, query.owner, TICKETS_PAGE);
    return sendRoute(reply, parlaysRoute, {
      parlays: rows.map((r) => ({
        parlayId: r.parlay_id,
        state: r.state as "open",
        stake: r.stake,
        payout: r.payout,
        chanceE6: r.chance_e6,
        result: r.result,
        outcome: r.outcome as "win" | null,
        legs: r.legs.flatMap((l) => {
          const series = seriesOf(query.chainId, l.series_id as Hex);
          if (!series) return [];
          return [
            {
              windowId: l.window_id as Hex,
              symbol: series.market.symbol,
              cadenceSec: series.cadenceSec,
              start: Number(l.window_start),
              band: l.band,
              outcome: l.outcome as "pending",
            },
          ];
        }),
        updatedAt: r.updated_at.toISOString(),
      })),
    });
  });
}
