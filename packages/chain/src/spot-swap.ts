/**
 * J11 spot-token swap sends (S1b.16): what the user's own account sends to buy a token with USDC or sell it for USDC
 * on Monad mainnet — ERC-20 `approve(Permit2, amountIn)`, `Permit2.approve(token, UniversalRouter, amountIn, expiry)`
 * (each only when the allowance on file is short) and `UniversalRouter.execute(V4_SWAP)` along the token's route.
 * Allowances are exact (never unlimited) and the Permit2 grant expires with the swap's deadline, so nothing is left
 * spendable after the swap. Native MON is settled from the call's value and needs no approval.
 *
 * Monad reserve rule (context/02-monad/differences-from-ethereum.md §2): an EIP-7702-delegated account can never send
 * MON value that takes it below 10 MON, so a MON sell is capped by `sellableNative`.
 */
import { MAINNET_EXTERNAL, SENDER_RESERVE_MON, type SpotToken, spotSwapGasLimit } from "@senryo/config";
import { ONE_E18 } from "@senryo/core";
import { type Address, erc20Abi } from "viem";
import { externalCall } from "./calls.ts";
import type { ReadClient } from "./clients.ts";
import type { TxRequest } from "./send.ts";
import { isNativeSpot, type SpotSide, spotPath } from "./spot.ts";
import { encodeExactIn, permit2Abi, universalRouterAbi } from "./uniswap.ts";

/** Default slippage: the minimum received is 0.5 % below the quote (volatile pairs; the stable swap uses 10 bps). */
export const SPOT_SLIPPAGE_BPS = 50n;
/** The router rejects the swap after this long; the Permit2 grant expires at the same moment. */
export const SPOT_DEADLINE_SEC = 300;

const BPS = 10_000n;
const MS_PER_SECOND = 1_000;

/** `amountOut` less `slippageBps` — the `minOut` a swap is sent with. */
export function spotMinOut(amountOut: bigint, slippageBps: bigint = SPOT_SLIPPAGE_BPS): bigint {
  return (amountOut * (BPS - slippageBps)) / BPS;
}

/** Native MON a sell may spend: the balance above the 10 MON reserve, less the swap's own gas cost (limit × max fee). */
export function sellableNative(balanceWei: bigint, gasCostWei: bigint): bigint {
  const spendable = balanceWei - SENDER_RESERVE_MON * ONE_E18 - gasCostWei;
  return spendable > 0n ? spendable : 0n;
}

/** What the owner has already granted on the input token (read before building, so nothing is approved twice). */
export interface SpotAllowance {
  /** ERC-20 allowance owner → Permit2. */
  erc20: bigint;
  /** Permit2 allowance owner → Universal Router for the token, and when it expires (unix seconds). */
  permit2: bigint;
  permit2Expiration: number;
}

const permit2AllowanceAbi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
  },
] as const;

/** Both allowances of `token` for `owner` in one multicall. */
export async function readSpotAllowance(read: ReadClient, owner: Address, token: Address): Promise<SpotAllowance> {
  const { permit2, universalRouter } = MAINNET_EXTERNAL.uniswapV4;
  const [erc20, [amount, expiration]] = await read.multicall({
    contracts: [
      { address: token, abi: erc20Abi, functionName: "allowance", args: [owner, permit2] },
      { address: permit2, abi: permit2AllowanceAbi, functionName: "allowance", args: [owner, token, universalRouter] },
    ],
    allowFailure: false,
  });
  return { erc20, permit2: amount, permit2Expiration: expiration };
}

export interface TokenSwapParams {
  token: SpotToken;
  side: SpotSide;
  /** USDC (6 decimals) on a buy; the token's raw units on a sell. */
  amountIn: bigint;
  /** The least of the output the swap may deliver (`spotMinOut(quote.amountOut)`). */
  minOut: bigint;
  /** Who receives the output — the user's own account. */
  recipient: Address;
  /** Allowances on file (`readSpotAllowance`); omitted → both approvals are sent. */
  allowance?: SpotAllowance | undefined;
  /**
   * The quote's `gasEstimate` (the Quoter's own metering of the pool swaps). A large trade crosses many ticks — a
   * $10,000 MON buy meters ~2.3M gas against ~0.2M for $10 — so the execute budget is sized from it when given.
   */
  quoteGas?: bigint | undefined;
  /** Unix seconds now (default: the device clock). */
  nowSec?: number | undefined;
}

/**
 * The ordered sends for one swap: [approve?, permit2Approve?, execute]. Each is a plain `TxRequest` for the account's
 * sender (explicit gas: estimate + headroom under the named budget). Send them in order and stop at the first failure.
 */
export function buildTokenSwap(params: TokenSwapParams): TxRequest[] {
  const { permit2, universalRouter } = MAINNET_EXTERNAL.uniswapV4;
  const { currencyIn, path } = spotPath(params.token, params.side);
  const nativeIn = params.side === "sell" && isNativeSpot(params.token);
  const now = params.nowSec ?? Math.floor(Date.now() / MS_PER_SECOND);
  const deadline = now + SPOT_DEADLINE_SEC;
  const meta = { kind: "spotSwap", token: params.token.symbol, side: params.side };
  const requests: TxRequest[] = [];
  if (!nativeIn) {
    const a = params.allowance;
    if (!a || a.erc20 < params.amountIn) {
      requests.push(
        externalCall(currencyIn, erc20Abi, "approve", [permit2, params.amountIn], "approve", {
          meta: { ...meta, step: "approve" },
        }),
      );
    }
    if (!a || a.permit2 < params.amountIn || a.permit2Expiration < deadline) {
      requests.push(
        externalCall(
          permit2,
          permit2Abi,
          "approve",
          [currencyIn, universalRouter, params.amountIn, deadline],
          "permit2Approve",
          { meta: { ...meta, step: "permit2Approve" } },
        ),
      );
    }
  }
  const { commands, inputs } = encodeExactIn({
    currencyIn,
    path,
    amountIn: params.amountIn,
    minOut: params.minOut,
    recipient: params.recipient,
  });
  requests.push(
    externalCall(universalRouter, universalRouterAbi, "execute", [commands, inputs, BigInt(deadline)], "spotSwap", {
      gasCap: spotSwapGasLimit(path.length, params.quoteGas),
      meta: { ...meta, step: "execute" },
      ...(nativeIn ? { value: params.amountIn } : {}),
    }),
  );
  return requests;
}

/** `readSpotAllowance` for the sending account, then `buildTokenSwap` — the sends as the chain stands now. */
export async function prepareTokenSwap(
  read: ReadClient,
  owner: Address,
  params: Omit<TokenSwapParams, "allowance">,
): Promise<TxRequest[]> {
  const nativeIn = params.side === "sell" && isNativeSpot(params.token);
  const currencyIn = spotPath(params.token, params.side).currencyIn;
  const allowance = nativeIn ? undefined : await readSpotAllowance(read, owner, currencyIn);
  return buildTokenSwap({ ...params, allowance });
}
