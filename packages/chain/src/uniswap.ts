import { MAINNET_CHAIN_ID, MAINNET_EXTERNAL } from "@senryo/config";
import { type Address, encodeAbiParameters, encodePacked, getAddress, type Hex, keccak256, zeroAddress } from "viem";
import type { ReadClient } from "./clients.ts";
import { STABLE_POOL_CANDIDATES } from "./constants.ts";

/**
 * Uniswap v4 on Monad mainnet (D-021/D-093; docs.uniswap.org v4 guides, Context7 `/uniswap/docs`):
 *  - PoolId = keccak256(abi.encode(PoolKey{currency0, currency1, fee, tickSpacing, hooks})), currency0 < currency1
 *  - StateView.getSlot0 / getLiquidity read pool state; Quoter.quoteExactInputSingle is simulated (eth_call)
 *  - Universal Router `execute(commands, inputs, deadline)`: command V4_SWAP (0x10) with actions
 *    SWAP_EXACT_IN_SINGLE (0x06) · SETTLE_ALL (0x0c) · TAKE_ALL (0x0f) (same actions as CollateralSwapper).
 * The AUSD/USDC pool key is discovered onchain (no log scans): candidate keys → the one with liquidity.
 */

export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

const POOL_KEY_COMPONENTS = [
  { name: "currency0", type: "address" },
  { name: "currency1", type: "address" },
  { name: "fee", type: "uint24" },
  { name: "tickSpacing", type: "int24" },
  { name: "hooks", type: "address" },
] as const;

const stateViewAbi = [
  {
    type: "function",
    name: "getSlot0",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "protocolFee", type: "uint24" },
      { name: "lpFee", type: "uint24" },
    ],
  },
  {
    type: "function",
    name: "getLiquidity",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [{ name: "liquidity", type: "uint128" }],
  },
] as const;

export const v4QuoterAbi = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "poolKey", type: "tuple", components: POOL_KEY_COMPONENTS },
          { name: "zeroForOne", type: "bool" },
          { name: "exactAmount", type: "uint128" },
          { name: "hookData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

export function poolIdOf(key: PoolKey): Hex {
  return keccak256(
    encodeAbiParameters(POOL_KEY_COMPONENTS, [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]),
  );
}

/** Sort two currencies into a v4 key (currency0 < currency1). */
export function sortedKey(
  a: Address,
  b: Address,
  fee: number,
  tickSpacing: number,
  hooks: Address = zeroAddress,
): PoolKey {
  const [c0, c1] = BigInt(a) < BigInt(b) ? [a, b] : [b, a];
  return { currency0: getAddress(c0), currency1: getAddress(c1), fee, tickSpacing, hooks };
}

export interface PoolState {
  key: PoolKey;
  poolId: Hex;
  sqrtPriceX96: bigint;
  tick: number;
  lpFee: number;
  liquidity: bigint;
}

/** The deepest initialised AUSD/USDC pool among the candidates (mainnet only). */
export async function findStablePool(read: ReadClient): Promise<PoolState | undefined> {
  if (read.chain.id !== MAINNET_CHAIN_ID) return undefined;
  const { ausd, usdc, uniswapV4 } = MAINNET_EXTERNAL;
  const keys = STABLE_POOL_CANDIDATES.map(([fee, spacing]) => sortedKey(ausd, usdc, fee, spacing));
  const states = await Promise.all(
    keys.map(async (key) => {
      const poolId = poolIdOf(key);
      const [[sqrtPriceX96, tick, , lpFee], liquidity] = await Promise.all([
        read.readContract({
          address: uniswapV4.stateView,
          abi: stateViewAbi,
          functionName: "getSlot0",
          args: [poolId],
        }),
        read.readContract({
          address: uniswapV4.stateView,
          abi: stateViewAbi,
          functionName: "getLiquidity",
          args: [poolId],
        }),
      ]);
      return { key, poolId, sqrtPriceX96, tick, lpFee, liquidity };
    }),
  );
  return states
    .filter((s) => s.sqrtPriceX96 !== 0n && s.liquidity > 0n)
    .sort((a, b) => (b.liquidity > a.liquidity ? 1 : -1))[0];
}

/** Quoter `quoteExactInputSingle` (simulated). */
export async function quoteExactIn(read: ReadClient, key: PoolKey, zeroForOne: boolean, amountIn: bigint) {
  const { result } = await read.simulateContract({
    address: MAINNET_EXTERNAL.uniswapV4.quoter,
    abi: v4QuoterAbi,
    functionName: "quoteExactInputSingle",
    args: [{ poolKey: key, zeroForOne, exactAmount: amountIn, hookData: "0x" }],
  });
  const [amountOut, gasEstimate] = result;
  return { amountOut, gasEstimate };
}

export const universalRouterAbi = [
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      { name: "commands", type: "bytes" },
      { name: "inputs", type: "bytes[]" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export const permit2Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
    ],
    outputs: [],
  },
] as const;

/** Universal Router command/action bytes (docs.uniswap.org; CollateralSwapper constants). */
export const UR = { V4_SWAP: 0x10, SWAP_EXACT_IN_SINGLE: 0x06, SETTLE_ALL: 0x0c, TAKE_ALL: 0x0f } as const;

/**
 * `execute` inputs for an exact-in single-hop swap. Universal Router 2.1.2 pins v4-periphery 545a5d2, whose
 * `ExactInputSingleParams` has **six** fields — (poolKey, zeroForOne, amountIn, amountOutMinimum, minHopPriceX36,
 * hookData) — and the decoder requires ≥ 0x160 bytes (D-122). The 5-field layout in docs.uniswap.org reverts on the
 * deployed router (fork-verified); CollateralSwapper encodes the same six fields (D-180). `minHopPriceX36 = 0`
 * disables the per-hop floor (for exact-in single it equals `amountOutMinimum`).
 */
export function encodeExactInSingle(params: { key: PoolKey; zeroForOne: boolean; amountIn: bigint; minOut: bigint }): {
  commands: Hex;
  inputs: Hex[];
} {
  const tokenIn = params.zeroForOne ? params.key.currency0 : params.key.currency1;
  const tokenOut = params.zeroForOne ? params.key.currency1 : params.key.currency0;
  const swap = encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { name: "poolKey", type: "tuple", components: POOL_KEY_COMPONENTS },
          { name: "zeroForOne", type: "bool" },
          { name: "amountIn", type: "uint128" },
          { name: "amountOutMinimum", type: "uint128" },
          { name: "minHopPriceX36", type: "uint256" },
          { name: "hookData", type: "bytes" },
        ],
      },
    ],
    [
      {
        poolKey: params.key,
        zeroForOne: params.zeroForOne,
        amountIn: params.amountIn,
        amountOutMinimum: params.minOut,
        minHopPriceX36: 0n,
        hookData: "0x",
      },
    ],
  );
  const settle = encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [tokenIn, params.amountIn]);
  const take = encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [tokenOut, params.minOut]);
  const actions = encodePacked(["uint8", "uint8", "uint8"], [UR.SWAP_EXACT_IN_SINGLE, UR.SETTLE_ALL, UR.TAKE_ALL]);
  const input = encodeAbiParameters([{ type: "bytes" }, { type: "bytes[]" }], [actions, [swap, settle, take]]);
  return { commands: encodePacked(["uint8"], [UR.V4_SWAP]), inputs: [input] };
}
