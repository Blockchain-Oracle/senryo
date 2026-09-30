/**
 * External reads go only through the Effect API (handlers run twice: preload + processing). Each chain gets its own
 * cache and rate limit (`crossChain: false`). Reads hit the archive RPC at the event's block, so a re-index returns
 * the same values.
 */
import { createEffect, S } from "envio";
import { createPublicClient, http, type PublicClient } from "viem";
import { RPC_EFFECT_CALLS_PER_SECOND } from "./constants.ts";
import { archiveRpcUrl } from "./env.ts";

const clients = new Map<number, PublicClient>();

/**
 * No JSON-RPC batching: the monadinfra archive endpoints answer a batch array with 403 "Restricted JSON RPC method"
 * (seen 2026-09-30). Each effect's rateLimit bounds the request rate instead.
 */
export function clientFor(chainId: number): PublicClient {
  let client = clients.get(chainId);
  if (!client) {
    client = createPublicClient({ transport: http(archiveRpcUrl(chainId)) });
    clients.set(chainId, client);
  }
  return client;
}

const CORE_ABI = [
  { type: "function", name: "AUSD", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "USDC", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  {
    type: "function",
    name: "account",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "usdc", type: "uint128" },
          { name: "ausd", type: "uint128" },
          { name: "holds", type: "uint128" },
          { name: "cardDebt", type: "uint128" },
          { name: "envelope", type: "uint128" },
          { name: "nonce", type: "uint64" },
          { name: "positionBitmap", type: "uint32" },
        ],
      },
    ],
  },
] as const;

const RATE = { calls: RPC_EFFECT_CALLS_PER_SECOND, per: "second" } as const;

/** SenryoCore's two collateral tokens (immutables) — cached forever per chain. */
export const coreTokens = createEffect(
  {
    name: "coreTokens",
    input: S.string,
    output: S.schema({ ausd: S.string, usdc: S.string }),
    rateLimit: RATE,
    cache: true,
    crossChain: false,
  },
  async ({ input: core, context }) => {
    const client = clientFor(context.chain.id);
    const address = core as `0x${string}`;
    const [ausd, usdc] = await Promise.all([
      client.readContract({ address, abi: CORE_ABI, functionName: "AUSD" }),
      client.readContract({ address, abi: CORE_ABI, functionName: "USDC" }),
    ]);
    return { ausd: ausd.toLowerCase(), usdc: usdc.toLowerCase() };
  },
);

/**
 * `SenryoCore.account(user)` at a block: the exact per-token balances (events only carry flows). Returns null when
 * the archive read fails; that result is not cached, so a restart retries it.
 */
export const readAccountBalances = createEffect(
  {
    name: "readAccountBalances",
    input: S.schema({ core: S.string, user: S.string, block: S.number }),
    output: S.nullable(S.schema({ ausd: S.bigint, usdc: S.bigint })),
    rateLimit: RATE,
    cache: true,
    crossChain: false,
  },
  async ({ input, context }) => {
    try {
      const account = await clientFor(context.chain.id).readContract({
        address: input.core as `0x${string}`,
        abi: CORE_ABI,
        functionName: "account",
        args: [input.user as `0x${string}`],
        blockNumber: BigInt(input.block),
      });
      return { ausd: account.ausd, usdc: account.usdc };
    } catch (error) {
      context.log.warn("account() archive read failed; balance left as last known", {
        user: input.user,
        block: input.block,
        error: error instanceof Error ? error.message : String(error),
      });
      context.cache = false;
      return null;
    }
  },
);
