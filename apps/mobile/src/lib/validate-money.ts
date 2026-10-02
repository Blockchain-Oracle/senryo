import { erc20Abi, readAccountSnapshot } from "@senryo/chain";
import type { Address } from "@senryo/core";
import { type CollateralSymbol, collateralTokenOf, maxWithdrawable, type QueryEnv } from "@senryo/query";
/** Fresh balance check across preparation/authentication, with the reviewed source unchanged. */
export async function validateMoney(
  env: QueryEnv,
  address: Address,
  source: "wallet" | "trading",
  symbol: CollateralSymbol,
  amount: bigint,
) {
  const balance =
    source === "wallet"
      ? await env.read.readContract({
          address: collateralTokenOf(env.chainId, symbol),
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address],
          blockTag: "latest",
        })
      : maxWithdrawable(await readAccountSnapshot(env.read, env.chainId, address, "latest"), symbol);
  if (amount <= 0n || amount > balance) throw new Error("The source balance changed. Review this amount again.");
}
