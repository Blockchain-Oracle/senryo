/**
 * J11 spot-token reads on Monad mainnet (S1b.16): USD prices from each route's slot0, exact-in quotes from the v4
 * Quoter with the price impact beyond the LP fees, and wallet holdings. Tokens and their routes come from
 * `@senryo/config` (`SPOT_TOKENS`, generated); every route starts at USDC, which is the dollar here (prices are in USDC).
 * Pass a mainnet read client — the pools exist only on 143.
 */
import { MAINNET_EXTERNAL, SPOT_NATIVE, type SpotPool, type SpotToken } from "@senryo/config";
import { type Address, erc20Abi, getAddress, multicall3Abi } from "viem";
import type { ReadClient } from "./clients.ts";
import { MULTICALL3_ADDRESS } from "./constants.ts";
import { type PathKey, type PoolState, quoteExactInPath, readPoolStates } from "./uniswap.ts";

export type SpotSide = "buy" | "sell";

/** USDC has 6 decimals; a price18 is USD × 1e18 per whole token. */
const USDC_DECIMALS = 6;
const PRICE_DECIMALS = 18;
const USD6_DECIMALS = 6;
/** v4 fees are in pips: 1,000,000 = 100 %. */
const PIPS = 1_000_000n;
const BPS = 10_000n;
/** sqrtPriceX96² = price × 2^192. */
const Q192_BITS = 192n;
const Q192 = 1n << Q192_BITS;
const TEN = 10n;

/** A rational exchange rate: `num / den` raw units of the output per raw unit of the input. */
interface Ratio {
  num: bigint;
  den: bigint;
}

const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

export interface SpotPath {
  currencyIn: Address;
  currencyOut: Address;
  path: PathKey[];
  /** The pools in the order the swap crosses them. */
  pools: SpotPool[];
}

/** Buy: USDC → token along `route`; sell: token → USDC, the route walked backwards. */
export function spotPath(token: SpotToken, side: SpotSide): SpotPath {
  const usdc = getAddress(MAINNET_EXTERNAL.usdc);
  const pools = side === "buy" ? [...token.route] : [...token.route].reverse();
  const currencyIn = side === "buy" ? usdc : token.address;
  let current: Address = currencyIn;
  const path = pools.map((pool) => {
    const { currency0, currency1, fee, tickSpacing, hooks } = pool.key;
    const next = same(current, currency0) ? currency1 : currency0;
    if (!same(current, currency0) && !same(current, currency1))
      throw new Error(`${token.symbol}: route hop ${pool.poolId} does not trade ${current}`);
    current = next;
    return { intermediateCurrency: next, fee, tickSpacing, hooks, hookData: "0x" as const };
  });
  return { currencyIn, currencyOut: current, path, pools };
}

/** Mid rate of one hop from `from` (no fee, no impact): P = sqrtPriceX96² / 2^192 is currency1 per currency0. */
function hopRate(state: PoolState, from: Address): Ratio {
  const p2 = state.sqrtPriceX96 * state.sqrtPriceX96;
  return same(from, state.key.currency0) ? { num: p2, den: Q192 } : { num: Q192, den: p2 };
}

/** Mid rate along a whole path, from the pool states read for it. */
function pathRate(path: SpotPath, states: ReadonlyMap<string, PoolState>): Ratio | undefined {
  let rate: Ratio = { num: 1n, den: 1n };
  let current = path.currencyIn;
  for (const [i, pool] of path.pools.entries()) {
    const state = states.get(pool.poolId.toLowerCase());
    const hop = path.path[i];
    if (!state || !hop || state.sqrtPriceX96 === 0n) return undefined;
    const r = hopRate(state, current);
    rate = { num: rate.num * r.num, den: rate.den * r.den };
    current = hop.intermediateCurrency;
  }
  return rate;
}

async function statesFor(read: ReadClient, pools: readonly SpotPool[]): Promise<Map<string, PoolState>> {
  const unique = [...new Map(pools.map((p) => [p.poolId.toLowerCase(), p])).values()];
  const states = await readPoolStates(
    read,
    unique.map((p) => p.key),
  );
  return new Map(states.map((s) => [s.poolId.toLowerCase(), s]));
}

/** USD × 1e18 per whole token from a token → USDC mid rate. */
function price18Of(token: SpotToken, sell: Ratio): bigint {
  return (sell.num * TEN ** BigInt(token.decimals + PRICE_DECIMALS)) / (sell.den * TEN ** BigInt(USDC_DECIMALS));
}

export interface SpotPrice {
  token: SpotToken;
  /** USD (USDC) × 1e18 per whole token at the route's mid price; undefined when a hop has no live pool. */
  priceUsd18: bigint | undefined;
}

/** Mid prices of every token in one multicall (each distinct pool read once, all at the same block). */
export async function readSpotPrices(read: ReadClient, tokens: readonly SpotToken[]): Promise<SpotPrice[]> {
  const states = await statesFor(
    read,
    tokens.flatMap((t) => t.route),
  );
  return tokens.map((token) => {
    const rate = pathRate(spotPath(token, "sell"), states);
    return { token, priceUsd18: rate ? price18Of(token, rate) : undefined };
  });
}

export interface SpotQuote {
  token: SpotToken;
  side: SpotSide;
  amountIn: bigint;
  /** Raw units of the output (the token on a buy, USDC on a sell), as the Quoter simulated it now. */
  amountOut: bigint;
  /** What `amountIn` is worth at the mid price, before fees and impact. */
  spotOut: bigint;
  /** The route's LP fees combined (bps of the input). */
  feeBps: bigint;
  /** How much worse than `spotOut` after fees the quote is: the trade's own price impact (bps, ≥ 0). */
  priceImpactBps: bigint;
  gasEstimate: bigint;
}

/** Π (1 − fee) over the path's pools, as a ratio. */
function feeFactor(pools: readonly SpotPool[]): Ratio {
  return pools.reduce<Ratio>((acc, p) => ({ num: acc.num * (PIPS - BigInt(p.key.fee)), den: acc.den * PIPS }), {
    num: 1n,
    den: 1n,
  });
}

/** Exact-in quote for a buy (`amountIn` USDC) or a sell (`amountIn` of the token), with impact vs the mid price. */
export async function quoteSpot(
  read: ReadClient,
  token: SpotToken,
  side: SpotSide,
  amountIn: bigint,
): Promise<SpotQuote> {
  const path = spotPath(token, side);
  const [quote, states] = await Promise.all([
    quoteExactInPath(read, path.currencyIn, path.path, amountIn),
    statesFor(read, path.pools),
  ]);
  const rate = pathRate(path, states);
  if (!rate) throw new Error(`${token.symbol}: a pool on its route is not initialised`);
  const spotOut = (amountIn * rate.num) / rate.den;
  const fees = feeFactor(path.pools);
  const feeBps = BPS - (BPS * fees.num) / fees.den;
  const afterFees = (spotOut * fees.num) / fees.den;
  const short = afterFees - quote.amountOut;
  const priceImpactBps = afterFees > 0n && short > 0n ? (short * BPS) / afterFees : 0n;
  return {
    token,
    side,
    amountIn,
    amountOut: quote.amountOut,
    spotOut,
    feeBps,
    priceImpactBps,
    gasEstimate: quote.gasEstimate,
  };
}

export interface SpotHolding {
  token: SpotToken;
  /** Raw units held by the address (native MON from its balance, every other token from `balanceOf`). */
  balance: bigint;
}

/** Balances of `tokens` for `owner` in one multicall at one block (native MON through Multicall3.getEthBalance). */
export async function readSpotHoldings(
  read: ReadClient,
  owner: Address,
  tokens: readonly SpotToken[],
): Promise<SpotHolding[]> {
  const balances = await read.multicall({
    contracts: tokens.map((t) =>
      t.native
        ? ({ address: MULTICALL3_ADDRESS, abi: multicall3Abi, functionName: "getEthBalance", args: [owner] } as const)
        : ({ address: t.address, abi: erc20Abi, functionName: "balanceOf", args: [owner] } as const),
    ),
    allowFailure: false,
  });
  return tokens.map((token, i) => ({ token, balance: balances[i] as bigint }));
}

/** USD value (usd6) of `balance` raw units at `priceUsd18`. */
export function spotValueUsd6(balance: bigint, decimals: number, priceUsd18: bigint): bigint {
  return (balance * priceUsd18) / TEN ** BigInt(decimals + PRICE_DECIMALS - USD6_DECIMALS);
}

/** True for the native-MON spot token (v4 `address(0)`). */
export function isNativeSpot(token: Pick<SpotToken, "address">): boolean {
  return same(token.address, SPOT_NATIVE);
}

/** The quote currency a buy spends: the owner's mainnet USDC balance (raw, 6 decimals). */
export async function readWalletUsdc(read: ReadClient, owner: Address): Promise<bigint> {
  return read.readContract({ address: MAINNET_EXTERNAL.usdc, abi: erc20Abi, functionName: "balanceOf", args: [owner] });
}
