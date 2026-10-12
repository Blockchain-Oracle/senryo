import { rideCatalogRoute, rideRoute, ridesRoute, submitRideRoute } from "@senryo/api-client";
import { type Hex, isDeployed } from "@senryo/chain";
import { RIDE_MARKETS, RIDE_TERMS } from "@senryo/config";
import { rideTrailStopE8 } from "@senryo/core";
import type { HttpServer } from "@senryo/service-common";
import { HTTP_STATUS, HttpError, parseRoute, type RideRow, rideById, ridesOf, sendRoute } from "@senryo/service-common";
import type { ApiContext } from "../context.ts";
import { RIDES_PAGE } from "../relay/constants.ts";

/**
 * Rides over HTTP (R4.4, D-299): the ride markets and their terms, a signed ride relayed gas-free, the caller's rides
 * with their exits, and one ride by id — its receipt (R5.11). A ride's exit goes through `/v1/markets/exits` (book 2).
 */
const RIDES_PER_MINUTE = 30;
const MINUTE_MS = 60_000;

interface ExitRow {
  ride_id: bigint;
  take_profit_e8: bigint;
  stop_loss_e8: bigint;
  floor_e8: bigint;
  trail_bps: number;
  trail_peak_e8: bigint;
  fired_kind: number | null;
}

const num = (v: bigint | null) => (v === null ? null : Number(v));

export function registerRideRoutes(app: HttpServer, ctx: ApiContext): void {
  app.get(rideCatalogRoute.path, async (request, reply) => {
    const { query } = parseRoute(rideCatalogRoute, request);
    const t = RIDE_TERMS[query.chainId];
    return sendRoute(reply, rideCatalogRoute, {
      chainId: query.chainId,
      deployed: isDeployed(query.chainId, "BandReserve"),
      markets: RIDE_MARKETS.map((symbol, marketId) => ({ marketId, symbol, ...t.markets[symbol] })),
      terms: {
        maxProfitBps: t.maxProfitBps,
        maxMoveBps: t.maxMoveBps,
        maxLifeSec: t.maxLifeSec,
        minMargin: t.minMargin,
        maxMargin: t.maxMargin,
        earlyFeeBps: t.earlyFeeBps,
        earlyWindowSec: t.earlyWindowSec,
      },
    });
  });

  app.post(
    submitRideRoute.path,
    { config: { rateLimit: { max: RIDES_PER_MINUTE, timeWindow: MINUTE_MS } } },
    async (request, reply) => {
      const { body } = parseRoute(submitRideRoute, request);
      const m = ctx.markets.get(body.chainId);
      if (!m) throw new HttpError(HTTP_STATUS.unavailable, "NOT_DEPLOYED", `rides are not live on ${body.chainId}`);
      const status = await m.rides.submit({ ...body, signature: body.signature as Hex });
      return sendRoute(reply, submitRideRoute, status);
    },
  );

  app.get(ridesRoute.path, async (request, reply) => {
    const { query } = parseRoute(ridesRoute, request);
    const rows = await ridesOf(ctx.db, query.chainId, query.owner, RIDES_PAGE);
    const exits = new Map(
      rows.length === 0
        ? []
        : (
            await ctx.db<ExitRow[]>`SELECT * FROM ride_exits WHERE chain_id = ${query.chainId}
              AND ride_id IN ${ctx.db(rows.map((r) => r.ride_id))}`
          ).map((e) => [e.ride_id, e]),
    );
    return sendRoute(reply, ridesRoute, {
      rides: rows.map((r) => rideView(r, exits.get(r.ride_id))),
    });
  });

  app.get(rideRoute.path, async (request, reply) => {
    const { params, query } = parseRoute(rideRoute, request);
    const row = await rideById(ctx.db, query.chainId, params.rideId);
    if (!row) throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", "no such ride");
    const [exit] = await ctx.db<ExitRow[]>`SELECT * FROM ride_exits WHERE chain_id = ${query.chainId}
      AND ride_id = ${params.rideId}`;
    return sendRoute(reply, rideRoute, { ride: rideView(row, exit) });
  });
}

function rideView(r: RideRow, e: ExitRow | undefined) {
  const levels = e && {
    takeProfitE8: e.take_profit_e8,
    stopLossE8: e.stop_loss_e8,
    floorE8: e.floor_e8,
    trailBps: e.trail_bps,
  };
  return {
    rideId: r.ride_id,
    marketId: r.market_id,
    symbol: RIDE_MARKETS[r.market_id] ?? "?",
    isLong: r.is_long,
    state: r.state as "open",
    margin: r.margin,
    marginOpen: r.margin_open,
    leverageBps: r.leverage_bps,
    openFee: r.open_fee,
    size: BigInt(r.size),
    reserve: r.reserve,
    entryE8: r.entry_e8,
    koE8: r.ko_e8,
    capE8: r.cap_e8,
    target: num(r.target),
    filledAt: num(r.filled_at),
    endAt: num(r.end_at),
    exitE8: r.exit_e8,
    pnl: r.pnl === null ? null : BigInt(r.pnl),
    fees: r.fees,
    paid: r.paid,
    exit:
      e && levels
        ? {
            ...levels,
            trailStopE8: rideTrailStopE8(levels, r.is_long, e.trail_peak_e8),
            firedKind: e.fired_kind,
          }
        : null,
    lastTx: (r.last_tx as `0x${string}` | null) ?? null,
    updatedAt: r.updated_at.toISOString(),
  };
}
