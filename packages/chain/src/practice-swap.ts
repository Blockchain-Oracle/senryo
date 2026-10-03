/**
 * Practice swap sends (D-252, flow book B6 (P), UNDEFINED-6): AUSD ↔ USDC at par on Monad testnet through our own
 * `PracticeSwap` (contracts/src/testnet/PracticeSwap.sol) — `[approve(PracticeSwap, exactAmountIn)?,
 * swap(tokenIn, amountIn, minOut = amountIn, recipient)]` from the user's own account. Not a market: one practice dollar
 * for one, so there is no quote to fetch and nothing to slip; the swap fails only on a float short of the output or a
 * balance spent elsewhere, and the send's estimate (its simulation) refuses that before anything is signed. The
 * approval is exact and skipped when the allowance on file already covers the input. Every other pair, and every
 * network without a recorded PracticeSwap, has no practice route.
 */
import type { ChainId } from "@senryo/config";
import { type Address, erc20Abi } from "viem";
import { contractCall, externalCall } from "./calls.ts";
import type { ReadClient } from "./clients.ts";
import { addressOf, isDeployed } from "./contracts.ts";
import type { TxRequest } from "./send.ts";

/** What Details and the receipt call the route: never a market, never a price. */
export const PRACTICE_SWAP_ROUTE = "Practice swap · at par";

/** The float can't pay this swap now (another practice user drained that side; it is refilled by the deployer). */
export class PracticeSwapFloatError extends Error {
  constructor(
    readonly float: bigint,
    readonly amountOut: bigint,
  ) {
    super(`the practice swap holds ${float} of the output; ${amountOut} needed`);
    this.name = "PracticeSwapFloatError";
  }
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** The mock `tokenIn` swaps into at par on `chainId`, or undefined when it has no practice route. */
export function practiceSwapCounterpart(chainId: ChainId, tokenIn: Address): Address | undefined {
  if (!isDeployed(chainId, "PracticeSwap")) return undefined;
  const ausd = addressOf(chainId, "MockAUSD");
  const usdc = addressOf(chainId, "MockUSDC");
  if (same(tokenIn, ausd)) return usdc;
  if (same(tokenIn, usdc)) return ausd;
  return undefined;
}

/** Is `tokenIn → tokenOut` the practice par pair on `chainId`? */
export function isPracticeSwapPair(chainId: ChainId, tokenIn: Address, tokenOut: Address): boolean {
  const out = practiceSwapCounterpart(chainId, tokenIn);
  return out !== undefined && same(out, tokenOut);
}

export interface PracticeSwapParams {
  chainId: ChainId;
  tokenIn: Address;
  /** Raw units of `tokenIn`; the same raw units of the other mock come out (both 6 decimals, asserted onchain). */
  amountIn: bigint;
  /** Who receives the output — the user's own account. */
  recipient: Address;
  /** ERC-20 allowance owner → PracticeSwap on file; omitted → the approval is sent. */
  allowance?: bigint | undefined;
}

/** The ordered sends for one practice swap: [approve?, swap]. Send them in order and stop at the first failure. */
export function buildPracticeSwap(params: PracticeSwapParams): TxRequest[] {
  const tokenOut = practiceSwapCounterpart(params.chainId, params.tokenIn);
  if (!tokenOut) throw new Error(`practice swap: no par route from ${params.tokenIn} on ${params.chainId}`);
  if (params.amountIn <= 0n) throw new Error("practice swap: the input amount must be positive");
  const spender = addressOf(params.chainId, "PracticeSwap");
  const meta = { kind: "practiceSwap", tokenIn: params.tokenIn, tokenOut };
  const requests: TxRequest[] = [];
  if (params.allowance === undefined || params.allowance < params.amountIn) {
    requests.push(
      externalCall(params.tokenIn, erc20Abi, "approve", [spender, params.amountIn], "approve", {
        meta: { ...meta, step: "approve" },
      }),
    );
  }
  requests.push(
    contractCall(
      params.chainId,
      "PracticeSwap",
      "swap",
      [params.tokenIn, params.amountIn, params.amountIn, params.recipient],
      "practiceSwap",
      { meta: { ...meta, step: "swap" } },
    ),
  );
  return requests;
}

/**
 * Reads what the chain says now — the allowance owner → PracticeSwap and the float of the output — and builds the
 * sends; a float short of the output throws `PracticeSwapFloatError` before anything exists to sign.
 */
export async function preparePracticeSwap(
  read: ReadClient,
  owner: Address,
  params: Omit<PracticeSwapParams, "allowance">,
): Promise<TxRequest[]> {
  const tokenOut = practiceSwapCounterpart(params.chainId, params.tokenIn);
  if (!tokenOut) return buildPracticeSwap(params);
  const spender = addressOf(params.chainId, "PracticeSwap");
  const [allowance, float] = await read.multicall({
    contracts: [
      { address: params.tokenIn, abi: erc20Abi, functionName: "allowance", args: [owner, spender] },
      { address: tokenOut, abi: erc20Abi, functionName: "balanceOf", args: [spender] },
    ],
    allowFailure: false,
    blockTag: "latest",
  });
  if (float < params.amountIn) throw new PracticeSwapFloatError(float, params.amountIn);
  return buildPracticeSwap({ ...params, allowance });
}
