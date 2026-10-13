/**
 * The mode sheet's balance per network, read by the api (the app makes no RPC calls, D-280): Practice's Test USD from
 * `/v1/markets/account`. Real reads as undefined until the mainnet markets deploy (S9) — never a fabricated $0.
 */
import { marketAccountRoute } from "@senryo/api-client";
import { MAINNET, TESTNET } from "@senryo/config";
import { marketKeys } from "@senryo/query";
import { useQuery } from "@tanstack/react-query";
import { api } from "~/lib/account/api";
import { useAccount } from "~/lib/account/provider";
import { BALANCE_STALE_MS } from "./constants";

/** Networks whose markets the api serves (Practice now; Real joins at S9). */
const SERVED = new Set<number>([TESTNET.chainId]);

/**
 * The key is `useMarketAccount`'s, so the cache holds the same shape — the whole account — and this reads `.balance`
 * through `select`. It used to cache the bare balance under that key: after a switch the account object landed where
 * this sheet read a bigint, the money format threw, and with a passkey account the app crashed (D0, 13 Oct).
 */
function useDollars(chainId: typeof TESTNET.chainId | typeof MAINNET.chainId) {
  const owner = useAccount().hint?.address;
  return useQuery({
    queryKey: marketKeys.account(chainId, owner ?? "0x"),
    queryFn: async () => {
      if (!owner) throw new Error("no account");
      return api().call(marketAccountRoute, { query: { chainId, owner } });
    },
    select: (account) => account.balance,
    enabled: owner !== undefined && SERVED.has(chainId),
    staleTime: BALANCE_STALE_MS,
  });
}

export function useNetworkBalances() {
  const practice = useDollars(TESTNET.chainId);
  const mainnet = useDollars(MAINNET.chainId);
  return { practice: practice.data, mainnet: mainnet.data, practicePartial: false, mainnetPartial: false };
}
