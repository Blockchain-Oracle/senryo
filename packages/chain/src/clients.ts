import type { ChainId } from "@senryo/config";
import { type Chain, createPublicClient, fallback, http, type PublicClient, type Transport, webSocket } from "viem";
import { networkFor, viemChain } from "./chains.ts";
import { HTTP_TIMEOUT_MS, POLL_INTERVAL_MS } from "./constants.ts";

export type ReadClient = PublicClient<Transport, Chain>;

/**
 * Optional endpoint overrides (a service may prefer a paid RPC from its env). Defaults come from `@senryo/config`.
 * URLs are data from config/env — never literals here (invariant `chain-literals`).
 */
export interface RpcOverrides {
  http?: readonly string[] | undefined;
  ws?: readonly string[] | undefined;
}

/** How many RPCs the same signed tx is broadcast to (D-027: two in parallel). */
export const BROADCAST_FANOUT = 2;

function httpUrls(chainId: ChainId, overrides?: RpcOverrides): readonly string[] {
  return overrides?.http?.length ? overrides.http : networkFor(chainId).rpcHttp;
}

function wsUrls(chainId: ChainId, overrides?: RpcOverrides): readonly string[] {
  return overrides?.ws?.length ? overrides.ws : networkFor(chainId).rpcWs;
}

/** Reads: fallback across the network's HTTP RPCs, polling at half a block. */
export function createReadClient(chainId: ChainId, overrides?: RpcOverrides): ReadClient {
  const transports = httpUrls(chainId, overrides).map((url) => http(url, { timeout: HTTP_TIMEOUT_MS }));
  return createPublicClient({
    chain: viemChain(chainId),
    transport: fallback(transports),
    pollingInterval: POLL_INTERVAL_MS,
  });
}

/**
 * Broadcast targets: one client per RPC (no fallback, no retries — a retry of a raw tx is our decision, not the
 * transport's). The same signed bytes go to all of them at once.
 */
export function createBroadcastClients(chainId: ChainId, overrides?: RpcOverrides): ReadClient[] {
  return httpUrls(chainId, overrides)
    .slice(0, BROADCAST_FANOUT)
    .map((url) =>
      createPublicClient({
        chain: viemChain(chainId),
        transport: http(url, { timeout: HTTP_TIMEOUT_MS, retryCount: 0 }),
        pollingInterval: POLL_INTERVAL_MS,
      }),
    );
}

/** WebSocket client for head/commit-state subscriptions (first WS URL; viem reconnects). */
export function createWsClient(chainId: ChainId, overrides?: RpcOverrides): ReadClient | undefined {
  const [url] = wsUrls(chainId, overrides);
  if (!url) return undefined;
  return createPublicClient({
    chain: viemChain(chainId),
    transport: webSocket(url, { keepAlive: true, reconnect: true }),
    pollingInterval: POLL_INTERVAL_MS,
  });
}
