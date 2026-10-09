/**
 * The user's stream events keep the query cache true without polling (D-272): a ticket change refreshes the caller's
 * tickets and balance at once and their history once the indexer has it (it follows the chain within ~2 s, D-279); a
 * call's status is written straight into its query; a session or dollar event refreshes the account.
 */

import type { DuelQueueView, IntentStatus } from "@senryo/api-client";
import type { Address } from "@senryo/core";
import type { Live } from "@senryo/live";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { duelKeys } from "./duels.ts";
import { earnKeys } from "./earn.ts";
import { useQueryEnv } from "./env.tsx";
import { eventKeys } from "./events.ts";
import { historyKeys } from "./history.ts";
import { marketKeys } from "./markets.ts";
import { parlayKeys } from "./parlays.ts";

/** The indexer trails a ticket notice by 0–2 s on production; history refetches after this. */
export const HISTORY_LAG_MS = 2_500;

interface TicketEventData {
  chainId: number;
  ticketId: string;
  owner: string;
}

/**
 * Refreshes the caller's tickets and balance now, and their history once the indexer has it: for changes the app
 * learns of itself — its own call settling, a window it holds closing — so a run without the user's topic (no API
 * session yet, D-280) still shows a fill or a result in seconds rather than at the 30 s fallback.
 */
export function useRefreshCaller(owner: Address | undefined): () => void {
  const env = useQueryEnv();
  const client = useQueryClient();
  return useCallback(() => {
    if (!owner) return;
    void client.invalidateQueries({ queryKey: marketKeys.tickets(env.chainId, owner) });
    void client.invalidateQueries({ queryKey: marketKeys.account(env.chainId, owner) });
    void client.invalidateQueries({ queryKey: marketKeys.loads(env.chainId) });
    setTimeout(
      () => void client.invalidateQueries({ queryKey: historyKeys.owner(env.chainId, owner) }),
      HISTORY_LAG_MS,
    );
  }, [client, env.chainId, owner]);
}

export function useLiveSync(live: Live, owner: Address | undefined): void {
  const env = useQueryEnv();
  const client = useQueryClient();

  // Public: a question listed, called, answered or settled moves the board for everyone.
  useEffect(
    () =>
      live.onMarket<{ chainId: number; eventId: string }>("event", (n) => {
        if (n.chainId !== env.chainId) return;
        void client.invalidateQueries({ queryKey: eventKeys.board(env.chainId) });
        void client.invalidateQueries({ queryKey: eventKeys.detail(env.chainId, n.eventId) });
      }),
    [live, env.chainId, client],
  );

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
      live.onUser("dollars", () => {
        void account();
        void client.invalidateQueries({ queryKey: earnKeys.all });
      }),
      live.onUser("earn", () => {
        void account();
        void client.invalidateQueries({ queryKey: earnKeys.all });
      }),
      live.onUser("parlay", () => {
        void account();
        void client.invalidateQueries({ queryKey: parlayKeys.of(env.chainId, owner) });
      }),
      live.onUser<DuelQueueView>("duelQueue", (entry) => {
        client.setQueryData(duelKeys.queue(env.chainId, owner), entry);
        void account();
      }),
      live.onUser<{ chainId: number }>("eventCall", (n) => {
        if (n.chainId !== env.chainId) return;
        void client.invalidateQueries({ queryKey: eventKeys.calls(env.chainId, owner) });
        void account();
      }),
      live.onUser<{ chainId: number; matchId: string; change: string }>("duel", (d) => {
        if (d.chainId !== env.chainId) return;
        void client.invalidateQueries({ queryKey: duelKeys.match(env.chainId, d.matchId) });
        void client.invalidateQueries({ queryKey: duelKeys.of(env.chainId, owner) });
        void account();
        // A card's call settling shows in the caller's history once the indexer has it.
        if (d.change === "cardSettled")
          later(() => client.invalidateQueries({ queryKey: historyKeys.owner(env.chainId, owner) }));
      }),
    ];
    return () => {
      for (const off of offs) off();
      for (const timer of timers) clearTimeout(timer);
    };
  }, [live, owner, env.chainId, client]);
}
