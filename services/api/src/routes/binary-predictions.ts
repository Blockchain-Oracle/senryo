import {
  binaryHistoryRoute,
  binaryPositionRoute,
  binaryQuoteRoute,
  binaryRoundRoute,
  binaryRoundsRoute,
} from "@senryo/api-client";
import { type HttpServer, parseRoute, sendRoute } from "@senryo/service-common";
import type { BinaryPredictions } from "../predictions/binary.ts";

const RATE = { rateLimit: { max: 30, timeWindow: "1 minute" } } as const;
export function registerBinaryPredictionRoutes(app: HttpServer, service: BinaryPredictions) {
  app.get(binaryRoundsRoute.path, { config: RATE }, async (request, reply) => {
    const { query } = parseRoute(binaryRoundsRoute, request);
    return sendRoute(
      reply,
      binaryRoundsRoute,
      await service.list(query.chainId, query.asset, Number(query.duration) as 300 | 900),
    );
  });
  app.get(binaryRoundRoute.path, { config: RATE }, async (request, reply) => {
    const { params, query } = parseRoute(binaryRoundRoute, request);
    return sendRoute(reply, binaryRoundRoute, await service.round(query.chainId, params.contract, params.roundId));
  });
  app.get(binaryPositionRoute.path, { config: RATE }, async (request, reply) => {
    const { params, query } = parseRoute(binaryPositionRoute, request);
    return sendRoute(
      reply,
      binaryPositionRoute,
      await service.round(query.chainId, params.contract, params.roundId, params.owner),
    );
  });
  app.get(binaryQuoteRoute.path, { config: RATE }, async (request, reply) => {
    const { params, query } = parseRoute(binaryQuoteRoute, request);
    return sendRoute(
      reply,
      binaryQuoteRoute,
      await service.quote(
        query.chainId,
        params.contract,
        params.roundId,
        query.owner,
        query.side,
        query.action,
        query.amountWei,
      ),
    );
  });
  app.get(binaryHistoryRoute.path, { config: RATE }, async (request, reply) => {
    const { params, query } = parseRoute(binaryHistoryRoute, request);
    return sendRoute(
      reply,
      binaryHistoryRoute,
      await service.history(query.chainId, params.contract, params.owner, query.cursor),
    );
  });
}
