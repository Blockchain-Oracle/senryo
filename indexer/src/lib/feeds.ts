/**
 * Chainlink aggregator discovery on mainnet. The XAU/XAG proxies are EACAggregatorProxy v0.6 (bytecode has no
 * AggregatorConfirmed topic, checked 2026-09-30), so an aggregator swap emits nothing. The proxy's own phase list is
 * the source of truth: an address is a feed aggregator iff `phaseAggregators(i)` returns it for some phase i ≤ phaseId.
 * A spoofed contract emitting AnswerUpdated can never pass. Only called for unknown addresses; the list is re-read at
 * most once per PROXY_PHASES_TTL_MS (the phase list only grows, so a re-index gives the same answer).
 */
import { CHAINLINK_PROXIES, type FeedSymbol, MAINNET_CHAIN_ID, PROXY_PHASES_TTL_MS } from "./constants.ts";
import { clientFor } from "./effects.ts";

const PROXY_ABI = [
  { type: "function", name: "phaseId", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint16" }] },
  {
    type: "function",
    name: "phaseAggregators",
    stateMutability: "view",
    inputs: [{ name: "phase", type: "uint16" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

let known: { at: number; bySymbol: Map<string, FeedSymbol> } | undefined;
let inFlight: Promise<Map<string, FeedSymbol>> | undefined;

async function readPhaseLists(): Promise<Map<string, FeedSymbol>> {
  const client = clientFor(MAINNET_CHAIN_ID);
  const map = new Map<string, FeedSymbol>();
  for (const { proxy, symbol } of CHAINLINK_PROXIES) {
    const phases = await client.readContract({ address: proxy, abi: PROXY_ABI, functionName: "phaseId" });
    const aggregators = await Promise.all(
      Array.from({ length: phases }, (_, i) =>
        client.readContract({ address: proxy, abi: PROXY_ABI, functionName: "phaseAggregators", args: [i + 1] }),
      ),
    );
    for (const aggregator of aggregators) map.set(aggregator.toLowerCase(), symbol);
  }
  return map;
}

/** The asset an address aggregates for, or undefined (unknown, not a feed, or the read failed). */
export async function aggregatorSymbol(chainId: number, address: string): Promise<FeedSymbol | undefined> {
  if (chainId !== MAINNET_CHAIN_ID) return undefined;
  const key = address.toLowerCase();
  const hit = known?.bySymbol.get(key);
  if (hit || (known && Date.now() - known.at < PROXY_PHASES_TTL_MS)) return hit;
  try {
    inFlight ??= readPhaseLists();
    known = { at: Date.now(), bySymbol: await inFlight };
  } catch {
    known = { at: Date.now(), bySymbol: known?.bySymbol ?? new Map() };
  } finally {
    inFlight = undefined;
  }
  return known.bySymbol.get(key);
}
