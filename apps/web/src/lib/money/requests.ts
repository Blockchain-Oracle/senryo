/**
 * The sends behind a move of any asset on Monad (B7/B8): a native MON transfer, an ERC-20 `transfer`, and the composed
 * pull of a dollar asset's trading part (`SenryoCore.withdraw(token, amount, to)` straight to the destination, so no
 * extra hop through the wallet). Source order: the wallet first, then the free trading part (B7 rule); the pull step
 * goes first in the operation (B0.4 order). Each step carries the reviewed facts in `meta`.
 */
import { erc20Abi, externalCall, type TxRequest } from "@senryo/chain";
import { type ChainId, positionCount } from "@senryo/config";
import { withdrawRequest } from "@senryo/query";
import type { MoneyAsset } from "./assets";
import type { PlannedStep } from "./use-money-operation";

export function transferRequest(asset: MoneyAsset, amount: bigint, to: `0x${string}`, kind: string): TxRequest {
  const meta = { kind, amount: amount.toString(), symbol: asset.symbol, recipient: to, source: "wallet" };
  if (asset.native) return { to, data: "0x", value: amount, action: "transfer", meta };
  return externalCall(asset.address, erc20Abi, "transfer", [to, amount], "erc20Transfer", { meta });
}

/** How much of `amount` comes from the wallet and how much from the trading account's free part. */
export function splitSource(asset: MoneyAsset, amount: bigint): { wallet: bigint; trading: bigint } {
  const wallet = amount <= asset.wallet ? amount : asset.wallet;
  return { wallet, trading: amount - wallet };
}

/**
 * The steps that move `amount` of `asset` to `to` on this network: [pull from trades]? → [transfer from wallet]?.
 * `positionBitmap` sizes the pull's gas budget (the core re-checks the account after it).
 */
export function moveSteps(
  chainId: ChainId,
  asset: MoneyAsset,
  amount: bigint,
  to: `0x${string}`,
  positionBitmap: number,
  kind: "send" | "withdraw",
): PlannedStep[] {
  const { wallet, trading } = splitSource(asset, amount);
  const steps: PlannedStep[] = [];
  if (trading > 0n && asset.collateral) {
    steps.push({
      role: "pull",
      action: "withdraw",
      label: "Pull from trades",
      request: withdrawRequest(chainId, asset.collateral, trading, to, positionCount(positionBitmap)),
    });
  }
  if (wallet > 0n) {
    steps.push({
      role: "act",
      action: asset.native ? "transfer" : "erc20Transfer",
      label: kind === "send" ? "Send" : "Withdraw",
      request: transferRequest(asset, wallet, to, kind),
    });
  }
  return steps;
}

/** The pull of a dollar asset's trading part into the account's own wallet (session scope), before a bridge. */
export function pullToSelfStep(
  chainId: ChainId,
  asset: MoneyAsset,
  amount: bigint,
  self: `0x${string}`,
  positionBitmap: number,
): PlannedStep | undefined {
  const { trading } = splitSource(asset, amount);
  if (trading === 0n || !asset.collateral) return undefined;
  return {
    role: "pull",
    action: "withdraw",
    label: "Pull from trades",
    request: withdrawRequest(chainId, asset.collateral, trading, self, positionCount(positionBitmap)),
  };
}
