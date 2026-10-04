import { predictionDetailRoute, predictionHistoryRoute, predictionsRoute } from "@senryo/api-client";
import { HTTP_STATUS, HttpError, type HttpServer, type Logger, parseRoute, sendRoute } from "@senryo/service-common";
import { CastoraDiscovery } from "../predictions/castora.ts";
import { PolymarketDiscovery } from "../predictions/polymarket.ts";

const RATE = { rateLimit: { max: 60, timeWindow: "1 minute" } } as const;
export function registerPredictionRoutes(app: HttpServer, log: Logger) {
  const binary = new PolymarketDiscovery();
  const contests = new CastoraDiscovery();
  const upstream = (err: unknown): never => {
    if (err instanceof HttpError) throw err;
    log.warn({ err: err instanceof Error ? err.message : "unknown" }, "prediction discovery failed");
    throw new HttpError(HTTP_STATUS.unavailable, "UPSTREAM_UNAVAILABLE", "Prediction data is unavailable right now");
  };
  const notFound = () => new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", "This prediction market is not available");
  app.get(predictionsRoute.path, { config: RATE }, async (request, reply) => {
    const { query } = parseRoute(predictionsRoute, request);
    const page = await (query.provider === "polymarket" ? binary.list(query) : contests.list()).catch(upstream);
    return sendRoute(reply, predictionsRoute, page);
  });
  app.get(predictionDetailRoute.path, { config: RATE }, async (request, reply) => {
    const { params } = parseRoute(predictionDetailRoute, request);
    const item = await (params.provider === "polymarket" ? binary.detail(params.id) : contests.detail(params.id)).catch(
      upstream,
    );
    if (!item) throw notFound();
    return sendRoute(reply, predictionDetailRoute, item);
  });
  app.get(predictionHistoryRoute.path, { config: RATE }, async (request, reply) => {
    const { params, query } = parseRoute(predictionHistoryRoute, request);
    if (params.provider !== "polymarket") throw notFound();
    const history = await binary.history(params.id, query.outcome).catch(upstream);
    if (!history) throw notFound();
    return sendRoute(reply, predictionHistoryRoute, history);
  });
}
