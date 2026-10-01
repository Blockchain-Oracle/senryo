import { MAINNET_CHAIN_ID, MAINNET_EXTERNAL } from "@senryo/config";
import { type Address, encodeAbiParameters, encodePacked, getAddress, type Hex, keccak256, zeroAddress } from "viem";
import type { ReadClient } from "./clients.ts";
import { STABLE_POOL_CANDIDATES } from "./constants.ts";

/**
 * Uniswap v4 on Monad mainnet (D-021/D-093; docs.uniswap.org v4 guides, Context7 `/uniswap/docs`):
 *  - PoolId = keccak256(abi.encode(PoolKey{currency0, currency1, fee, tickSpacing, hooks})), currency0 < currency1
 *  - StateView.getSlot0 / getLiquidity read pool state; Quoter.quoteExactInputSingle is simulated (eth_call)
 *  - Universal Router `execute(commands, inputs, deadline)`: command V4_SWAP (0x10) with actions
 *    SWAP_EXACT_IN_SINGLE (0x06) · SETTLE_ALL (0x0c) · TAKE_ALL (0x0f) (same actions as CollateralSwapper); spot
 *    tokens (J11) route multi-hop with SWAP_EXACT_IN (0x07) · SETTLE_ALL · TAKE (0x0e) to a recipient.
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

/** v4-periphery `PathKey`: the next currency of a hop and the pool that reaches it. */
const PATH_KEY_COMPONENTS = [
  { name: "intermediateCurrency", type: "address" },
  { name: "fee", type: "uint24" },
  { name: "tickSpacing", type: "int24" },
  { name: "hooks", type: "address" },
  { name: "hookData", type: "bytes" },
] as const;

export interface PathKey {
  intermediateCurrency: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
  hookData: Hex;
}

export const v4QuoterAbi = [
  {
    type: "function",
    name: "quoteExactInput",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "exactCurrency", type: "address" },
          { name: "path", type: "tuple[]", components: PATH_KEY_COMPONENTS },
          { name: "exactAmount", type: "uint128" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
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

/** Slot0 + in-range liquidity of each key (one multicall); an uninitialised pool reads sqrtPriceX96 = 0. */
export async function readPoolStates(read: ReadClient, keys: readonly PoolKey[]): Promise<PoolState[]> {
  const ids = keys.map(poolIdOf);
  const stateView = { address: MAINNET_EXTERNAL.uniswapV4.stateView, abi: stateViewAbi } as const;
  const rows = await read.multicall({
    contracts: ids.flatMap((poolId) => [
      { ...stateView, functionName: "getSlot0", args: [poolId] } as const,
      { ...stateView, functionName: "getLiquidity", args: [poolId] } as const,
    ]),
    allowFailure: false,
  });
  return keys.map((key, i) => {
    const [sqrtPriceX96, tick, , lpFee] = rows[2 * i] as readonly [bigint, number, number, number];
    const liquidity = rows[2 * i + 1] as bigint;
    return { key, poolId: ids[i] as Hex, sqrtPriceX96, tick, lpFee, liquidity };
  });
}

/** Initialised with liquidity in range — a pool a swap can actually go through. */
export function isLive(state: PoolState): boolean {
  return state.sqrtPriceX96 !== 0n && state.liquidity > 0n;
}

/** The deepest initialised AUSD/USDC pool among the candidates (mainnet only). */
export async function findStablePool(read: ReadClient): Promise<PoolState | undefined> {
  if (read.chain.id !== MAINNET_CHAIN_ID) return undefined;
  const { ausd, usdc } = MAINNET_EXTERNAL;
  const keys = STABLE_POOL_CANDIDATES.map(([fee, spacing]) => sortedKey(ausd, usdc, fee, spacing));
  const states = await readPoolStates(read, keys);
  return states.filter(isLive).sort((a, b) => (b.liquidity > a.liquidity ? 1 : -1))[0];
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

/** Quoter `quoteExactInput` along a multi-hop path from `currencyIn` (simulated). */
export async function quoteExactInPath(
  read: ReadClient,
  currencyIn: Address,
  path: readonly PathKey[],
  amountIn: bigint,
) {
  const { result } = await read.simulateContract({
    address: MAINNET_EXTERNAL.uniswapV4.quoter,
    abi: v4QuoterAbi,
    functionName: "quoteExactInput",
    args: [{ exactCurrency: currencyIn, path: [...path], exactAmount: amountIn }],
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
export const UR = {
  V4_SWAP: 0x10,
  SWAP_EXACT_IN_SINGLE: 0x06,
  SWAP_EXACT_IN: 0x07,
  SETTLE_ALL: 0x0c,
  TAKE: 0x0e,
  TAKE_ALL: 0x0f,
} as const;

/** v4-periphery `ActionConstants.OPEN_DELTA`: TAKE the whole credit the swap left (its own minimum already held). */
const OPEN_DELTA = 0n;

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

/**
 * `execute` inputs for an exact-in swap along a path (`SWAP_EXACT_IN`, then SETTLE_ALL the input and TAKE the whole
 * output to `recipient`). The same v4-periphery 545a5d2 layout as above: `ExactInputParams` is (currencyIn, path,
 * minHopPriceX36[], amountIn, amountOutMinimum); an empty `minHopPriceX36` skips the per-hop floors (the router allows
 * length 0) and `amountOutMinimum` holds the whole route. A native input (`address(0)`) is settled from the call's
 * `value`; a native output is sent to `recipient` as MON.
 */
export function encodeExactIn(params: {
  currencyIn: Address;
  path: readonly PathKey[];
  amountIn: bigint;
  minOut: bigint;
  recipient: Address;
}): { commands: Hex; inputs: Hex[] } {
  const last = params.path.at(-1);
  if (!last) throw new Error("encodeExactIn: empty path");
  const swap = encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { name: "currencyIn", type: "address" },
          { name: "path", type: "tuple[]", components: PATH_KEY_COMPONENTS },
          { name: "minHopPriceX36", type: "uint256[]" },
          { name: "amountIn", type: "uint128" },
          { name: "amountOutMinimum", type: "uint128" },
        ],
      },
    ],
    [
      {
        currencyIn: params.currencyIn,
        path: [...params.path],
        minHopPriceX36: [],
        amountIn: params.amountIn,
        amountOutMinimum: params.minOut,
      },
    ],
  );
  const settle = encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [params.currencyIn, params.amountIn]);
  const take = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "uint256" }],
    [last.intermediateCurrency, params.recipient, OPEN_DELTA],
  );
  const actions = encodePacked(["uint8", "uint8", "uint8"], [UR.SWAP_EXACT_IN, UR.SETTLE_ALL, UR.TAKE]);
  const input = encodeAbiParameters([{ type: "bytes" }, { type: "bytes[]" }], [actions, [swap, settle, take]]);
  return { commands: encodePacked(["uint8"], [UR.V4_SWAP]), inputs: [input] };
}
