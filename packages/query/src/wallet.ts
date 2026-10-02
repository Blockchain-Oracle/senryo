import { erc20Abi, externalCall, type TxRequest } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import type { Address } from "@senryo/core";
import { useQuery } from "@tanstack/react-query";
import { ACCOUNT_REFETCH_MS } from "./constants.ts";
import { useQueryEnv } from "./env.tsx";
import { keys } from "./keys.ts";
import { readingOf } from "./reading.ts";
import { type CollateralSymbol, collateralTokenOf } from "./withdraw.ts";

const TOKENS = ["AUSD", "USDC"] as const;
export function useWalletCollateral(address: Address | undefined) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: [...keys.account(env.chainId, address ?? "0x"), "wallet-collateral"],
    enabled: Boolean(address),
    staleTime: ACCOUNT_REFETCH_MS,
    refetchInterval: ACCOUNT_REFETCH_MS,
    queryFn: async (): Promise<Record<CollateralSymbol, bigint>> => {
      const block = await env.read.getBlock({ blockTag: "finalized" });
      const [AUSD, USDC] = await env.read.multicall({
        contracts: TOKENS.map(
          (symbol) =>
            ({
              address: collateralTokenOf(env.chainId, symbol),
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [address ?? "0x"],
            }) as const,
        ),
        allowFailure: false,
        blockNumber: block.number,
      });
      if (AUSD === undefined || USDC === undefined) throw new Error("Wallet balances unavailable");
      return { AUSD, USDC };
    },
  });
  return readingOf(query, ACCOUNT_REFETCH_MS);
}
export function walletTransferRequest(
  chainId: ChainId,
  symbol: CollateralSymbol,
  amount: bigint,
  recipient: Address,
): TxRequest {
  return externalCall(collateralTokenOf(chainId, symbol), erc20Abi, "transfer", [recipient, amount], "erc20Transfer", {
    meta: { amount: amount.toString(), symbol, recipient, source: "wallet" },
  });
}
