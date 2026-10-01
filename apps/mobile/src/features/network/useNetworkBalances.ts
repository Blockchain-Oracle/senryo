/**
 * Each network's equity for the selector (S8.22): read directly per chain (not through the active QueryEnv, which
 * only serves the selected network), with the same query keys as `useAccountRisk` so the cache is shared. Mainnet
 * before launch has no account to read — it reports `undefined` and the row says when it opens.
 */
import { readAccountSnapshot } from "@senryo/chain";
import { type ChainId, MAINNET, TESTNET } from "@senryo/config";
import { keys } from "@senryo/query";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "~/lib/account/provider";
import { sharedRead } from "~/lib/account/sender";
import { mainnetTradingLive } from "~/lib/network";
import { BALANCE_STALE_MS } from "./constants";

function useEquity(chainId: ChainId, enabled: boolean) {
  const address = useAccount().hint?.address;
  return useQuery({
    queryKey: keys.accountRisk(chainId, address ?? "0x", "finalized"),
    queryFn: () => readAccountSnapshot(sharedRead(chainId), chainId, address ?? "0x", "finalized"),
    enabled: enabled && address !== undefined,
    staleTime: BALANCE_STALE_MS,
  });
}

export function useNetworkBalances() {
  const practice = useEquity(TESTNET.chainId, true);
  const mainnet = useEquity(MAINNET.chainId, mainnetTradingLive());
  return { practice: practice.data?.equityInit, mainnet: mainnet.data?.equityInit };
}
