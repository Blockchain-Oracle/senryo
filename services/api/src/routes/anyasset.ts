/**
 * The any-asset routes (public, rate-limited per IP): `GET /v1/holdings`, `GET /v1/swap/quote` (D6) and
 * `GET /v1/bridge/{routes,quote,status}` (D2). A provider that can't answer is 503 UPSTREAM_UNAVAILABLE with a fixed
 * line; the full error (which may carry a provider's message) goes to the log only.
 */
import {
  bridgeQuoteRoute,
  bridgeRoutesRoute,
  bridgeStatusRoute,
  holdingsRoute,
  swapQuoteRoute,
} from "@senryo/api-client";
import { getAddress } from "@senryo/chain";
import { HTTP_STATUS, HttpError, type HttpServer, type Logger, parseRoute, sendRoute } from "@senryo/service-common";
import { BRIDGE_QUOTE_RATE, BRIDGE_READ_RATE, HOLDINGS_RATE, SWAP_QUOTE_RATE } from "../anyasset/constants.ts";
import type { AnyAssetServices } from "../anyasset/runtime.ts";
import { errorText } from "../anyasset/upstream.ts";

function upstream(log: Logger, what: string) {
  return (error: unknown): never => {
    if (error instanceof HttpError) throw error;
    log.warn({ err: errorText(error) }, `${what} failed`);
    throw new HttpError(HTTP_STATUS.unavailable, "UPSTREAM_UNAVAILABLE", `${what} is unavailable right now`);
  };
}

export function registerAnyAssetRoutes(app: HttpServer, log: Logger, services: AnyAssetServices): void {
  app.get(holdingsRoute.path, { config: HOLDINGS_RATE }, async (request, reply) => {
    const { query } = parseRoute(holdingsRoute, request);
    const holdings = await services.holdings
      .get(query.chainId, getAddress(query.address))
      .catch(upstream(log, "holdings"));
    return sendRoute(reply, holdingsRoute, holdings);
  });

  app.get(swapQuoteRoute.path, { config: SWAP_QUOTE_RATE }, async (request, reply) => {
    const { query } = parseRoute(swapQuoteRoute, request);
    const quote = await services.swaps
      .quote({
        chainId: query.chainId,
        from: getAddress(query.from),
        to: getAddress(query.to),
        amount: query.amount,
        sender: getAddress(query.sender),
        slippageBps: query.slippageBps,
      })
      .catch(upstream(log, "swap quote"));
    return sendRoute(reply, swapQuoteRoute, quote);
  });

  app.get(bridgeRoutesRoute.path, { config: BRIDGE_READ_RATE }, async (request, reply) => {
    const { query } = parseRoute(bridgeRoutesRoute, request);
    const routes = await services.bridges.routes(query.chainId, query.asset, query.direction);
    return sendRoute(reply, bridgeRoutesRoute, routes);
  });

  app.get(bridgeQuoteRoute.path, { config: BRIDGE_QUOTE_RATE }, async (request, reply) => {
    const { query } = parseRoute(bridgeQuoteRoute, request);
    const quote = await services.bridges
      .quote({ ...query, sender: getAddress(query.sender) })
      .catch(upstream(log, "bridge quote"));
    return sendRoute(reply, bridgeQuoteRoute, quote);
  });

  app.get(bridgeStatusRoute.path, { config: BRIDGE_READ_RATE }, async (request, reply) => {
    const { query } = parseRoute(bridgeStatusRoute, request);
    const status = await services.bridges
      .status(query.route, query.id, query.fromChain, query.toChain)
      .catch(upstream(log, "bridge status"));
    return sendRoute(reply, bridgeStatusRoute, status);
  });
}
