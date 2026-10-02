import { cardSummaryRoute } from "@senryo/api-client";
import { useQueryEnv } from "@senryo/query";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "~/lib/account/provider";
import { useSessionRunner } from "~/lib/account/use-session-runner";

const REFRESH_MS = 30_000;
export function useCardSummary() {
  const env = useQueryEnv();
  const account = useAccount();
  const address = account.hint?.address;
  const session = useSessionRunner();
  return useQuery({
    queryKey: ["account", env.chainId, address, "card-service"],
    enabled: Boolean(address && session && account.snapshot.status === "unlocked"),
    retry: false,
    staleTime: REFRESH_MS,
    queryFn: () => {
      if (!session || account.snapshot.status !== "unlocked") throw new Error("Unlock to load your card");
      return session(() => env.api.call(cardSummaryRoute, {}));
    },
  });
}
