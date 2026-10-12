import { windowStateRoute } from "@senryo/api-client";
import { addressOf, type Hex } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import { windowsAbi } from "@senryo/contracts/abis";
import type { HttpServer } from "@senryo/service-common";
import { parseRoute, sendRoute } from "@senryo/service-common";
import { type ApiContext, chainOf } from "../context.ts";

/**
 * Whether a window is open on chain (R5.25), for the lane on a terminal: an opened window stays opened, so a yes is
 * kept for good; a no is asked again after a few seconds (the first call may open it any moment within admission).
 */
const UNOPENED_CACHE_MS = 5_000;
const CACHE_MAX = 4_096;
const opened = new Set<string>();
const unopened = new Map<string, number>();

export function registerWindowRoutes(app: HttpServer, ctx: ApiContext): void {
  app.get(windowStateRoute.path, async (request, reply) => {
    const { params, query } = parseRoute(windowStateRoute, request);
    const key = `${query.chainId}:${params.windowId.toLowerCase()}`;
    const asked = unopened.get(key);
    if (opened.has(key) || (asked !== undefined && Date.now() - asked < UNOPENED_CACHE_MS)) {
      return sendRoute(reply, windowStateRoute, { windowId: params.windowId, opened: opened.has(key) });
    }
    const w = await chainOf(ctx, query.chainId as ChainId).read.readContract({
      address: addressOf(query.chainId as ChainId, "Windows"),
      abi: windowsAbi,
      functionName: "windowOf",
      args: [params.windowId as Hex],
    });
    const isOpen = w.expiry !== 0;
    if (isOpen) {
      if (opened.size >= CACHE_MAX) opened.clear();
      opened.add(key);
      unopened.delete(key);
    } else {
      if (unopened.size >= CACHE_MAX) unopened.clear();
      unopened.set(key, Date.now());
    }
    return sendRoute(reply, windowStateRoute, { windowId: params.windowId, opened: isOpen });
  });
}
