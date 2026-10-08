/**
 * The mode sheet's balance per network: the account's dollars there (USDC on Real, Test USD on Practice; D-258).
 * A network without its dollar token yet (Practice before the S2 deploy) reads as undefined, never a fabricated $0.
 */
import { dollarTokenOf, erc20Abi } from "@senryo/chain";
import { type ChainId, MAINNET, TESTNET } from "@senryo/config";
import { keys } from "@senryo/query";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "~/lib/account/provider";
import { sharedRead } from "~/lib/account/sender";
import { BALANCE_STALE_MS } from "./constants";

function useDollars(chainId: ChainId) {
  const address = useAccount().hint?.address;
  const token = dollarTokenOf(chainId);
  return useQuery({
    queryKey: [...keys.account(chainId, address ?? "0x"), "dollars"],
    queryFn: () =>
      sharedRead(chainId).readContract({
        address: token as `0x${string}`,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address ?? "0x"],
        blockTag: "finalized",
      }),
    enabled: address !== undefined && token !== undefined,
    staleTime: BALANCE_STALE_MS,
  });
}

export function useNetworkBalances() {
  const practice = useDollars(TESTNET.chainId);
  const mainnet = useDollars(MAINNET.chainId);
  return { practice: practice.data, mainnet: mainnet.data, practicePartial: false, mainnetPartial: false };
}
