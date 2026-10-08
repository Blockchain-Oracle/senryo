import { type CardAuthSummary, cardAuthDetailRoute, cardSummaryRoute } from "@senryo/api-client";
import { useQueryEnv } from "@senryo/query";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "~/lib/account/provider";
import { useSessionRunner } from "~/lib/account/use-session-runner";
import { useNetwork } from "~/lib/network";
import { CARD_NETWORKS } from "./card-problem";

/** The tab re-reads the service this often while it is on screen (E6: rows move Pending → Paid without a pull). */
const REFRESH_MS = 30_000;

export const cardSummaryKey = (chainId: number, address: string | undefined) =>
  ["account", chainId, address, "card-service"] as const;

/**
 * The authenticated card service's summary (E2–E6): the live card, holds, card debt, issuer status and recent
 * payments. Read only while the session is unlocked, so opening the tab never raises Face ID by itself, and only on a
 * network the card service runs on (`CARD_NETWORKS`): elsewhere the tab says so instead of polling a refusal. It
 * re-reads on a timer only where the caller is on screen (`poll`).
 */
export function useCardSummary({ poll = false }: { poll?: boolean } = {}) {
  const env = useQueryEnv();
  const network = useNetwork();
  const account = useAccount();
  const address = account.hint?.address;
  const session = useSessionRunner();
  return useQuery({
    queryKey: cardSummaryKey(env.chainId, address),
    enabled: Boolean(CARD_NETWORKS.has(network.key) && address && session && account.snapshot.status === "unlocked"),
    retry: false,
    staleTime: REFRESH_MS,
    refetchInterval: poll ? REFRESH_MS : false,
    queryFn: () => {
      if (!session || account.snapshot.status !== "unlocked") throw new Error("Unlock to load your card");
      return session(() => env.api.call(cardSummaryRoute, {}));
    },
  });
}

/** One payment by id (E6): the summary's copy when it has it, else the service's own record (older than the last 20). */
export function useCardPayment(id: string | undefined) {
  const env = useQueryEnv();
  const account = useAccount();
  const address = account.hint?.address;
  const session = useSessionRunner();
  const summary = useCardSummary();
  const cached = summary.data?.recent.find((row) => row.id === id);
  const query = useQuery({
    queryKey: [...cardSummaryKey(env.chainId, address), "auth", id] as const,
    enabled: Boolean(id && !cached && address && session && account.snapshot.status === "unlocked"),
    retry: false,
    queryFn: (): Promise<CardAuthSummary> => {
      if (!session || !id) throw new Error("Unlock to load this payment");
      return session(() => env.api.call(cardAuthDetailRoute, { params: { id } }));
    },
  });
  return { payment: cached ?? query.data, loading: !cached && query.isPending, failed: !cached && query.isError };
}
