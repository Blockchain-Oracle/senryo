/** Selector balances share Home's estimated portfolio basis, including the Mainnet wallet before core deployment. */
import { readPortfolio } from "@senryo/chain";
import { type ChainId, MAINNET, TESTNET } from "@senryo/config";
import { keys, ownLpRequests, useQueryEnv } from "@senryo/query";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "~/lib/account/provider";
import { sharedRead } from "~/lib/account/sender";
import { BALANCE_STALE_MS } from "./constants";

function useValue(chainId: ChainId) {
  const address = useAccount().hint?.address;
  const env = useQueryEnv();
  return useQuery({
    queryKey: [...keys.account(chainId, address ?? "0x"), "portfolio"],
    queryFn: () =>
      readPortfolio(sharedRead(chainId), chainId, address ?? "0x", (block) =>
        ownLpRequests(env.indexer, chainId, address ?? "0x", block),
      ),
    enabled: address !== undefined,
    staleTime: BALANCE_STALE_MS,
  });
}
export function useNetworkBalances() {
  const practice = useValue(TESTNET.chainId);
  const mainnet = useValue(MAINNET.chainId);
  const value = (reading: ReturnType<typeof useValue>) =>
    reading.data?.components.some((c) => c.supported !== false && c.valueUsd6 !== undefined)
      ? reading.data.totalUsd6
      : undefined;
  return {
    practice: value(practice),
    mainnet: value(mainnet),
    practicePartial: practice.data?.quality === "partial",
    mainnetPartial: mainnet.data?.quality === "partial",
  };
}
