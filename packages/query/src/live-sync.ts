/**
 * The user's stream events keep the query cache true without polling (D-272): a ticket change refreshes the caller's
 * tickets and balance at once and their history once the indexer has it (it follows the chain within ~2 s, D-279); a
 * call's status is written straight into its query; a session or dollar event refreshes the account.
 */
import type { IntentStatus } from "@senryo/api-client";
import type { Address } from "@senryo/core";
import type { Live } from "@senryo/live";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useQueryEnv } from "./env.tsx";
import { historyKeys } from "./history.ts";
import { marketKeys } from "./markets.ts";

/** The indexer trails a ticket notice by 0–2 s on production; history refetches after this. */
export const HISTORY_LAG_MS = 2_500;

interface TicketEventData {
  chainId: number;
  ticketId: string;
  owner: string;
}

export function useLiveSync(live: Live, owner: Address | undefined): void {
  const env = useQueryEnv();
  const client = useQueryClient();

  useEffect(() => {
    if (!owner) return;
    const account = () => client.invalidateQueries({ queryKey: marketKeys.account(env.chainId, owner) });
    const tickets = () => client.invalidateQueries({ queryKey: marketKeys.tickets(env.chainId, owner) });
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (run: () => void) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        run();
      }, HISTORY_LAG_MS);
      timers.add(timer);
    };

    const offs = [
      live.onUser<TicketEventData>("ticket", (t) => {
        if (t.chainId !== env.chainId) return;
        void tickets();
        void account();
        later(() => {
          void client.invalidateQueries({ queryKey: historyKeys.owner(env.chainId, owner) });
          void client.invalidateQueries({ queryKey: historyKeys.call(env.chainId, BigInt(t.ticketId)) });
        });
      }),
      live.onUser<IntentStatus>("intent", (status) => {
        client.setQueryData(marketKeys.intent(status.digest), status);
        if (status.state === "filled" || status.state === "refused") void tickets();
      }),
      live.onUser("session", () => void account()),
      live.onUser("dollars", () => void account()),
    ];
    return () => {
      for (const off of offs) off();
      for (const timer of timers) clearTimeout(timer);
    };
  }, [live, owner, env.chainId, client]);
}
