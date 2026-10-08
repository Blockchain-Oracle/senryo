/**
 * The wallet's own dollar balance (D-258). Until S3/S5 serve balances over the API stream (D-272), this reads the one
 * dollar token on the active network at the finalized block; the read client and this poll leave with S5.
 */
import { dollarTokenOf, erc20Abi, externalCall, type TxRequest } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import type { Address } from "@senryo/core";
import { useQuery } from "@tanstack/react-query";
import { ACCOUNT_REFETCH_MS } from "./constants.ts";
import { useQueryEnv } from "./env.tsx";
import { keys } from "./keys.ts";
import { readingOf } from "./reading.ts";

export function useDollarBalance(address: Address | undefined) {
  const env = useQueryEnv();
  const token = dollarTokenOf(env.chainId);
  const query = useQuery({
    queryKey: [...keys.account(env.chainId, address ?? "0x"), "dollars"],
    enabled: Boolean(address && token),
    staleTime: ACCOUNT_REFETCH_MS,
    refetchInterval: ACCOUNT_REFETCH_MS,
    queryFn: async (): Promise<bigint> => {
      if (!address || !token) throw new Error("Dollar balance unavailable");
      return env.read.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
        blockTag: "finalized",
      });
    },
  });
  return readingOf(query, ACCOUNT_REFETCH_MS);
}

/** A plain dollar transfer (always behind Face ID, D-267). Withdrawals move to relayed EIP-3009 in S5. */
export function dollarTransferRequest(chainId: ChainId, amount: bigint, recipient: Address): TxRequest {
  const token = dollarTokenOf(chainId);
  if (!token) throw new Error("No dollar token on this network yet");
  return externalCall(token, erc20Abi, "transfer", [recipient, amount], "erc20Transfer", {
    meta: { amount: amount.toString(), symbol: "USD", recipient, source: "wallet" },
  });
}
