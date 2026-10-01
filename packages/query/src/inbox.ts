/**
 * Deposit inbox (S8.24, D-230), shared by both apps. The address shown to the user always comes from the chain
 * (`InboxFactory.inboxOf`), never from the api. The watch registration tells the keeper to read an inbox that isn't
 * deployed yet (the indexer can't see it). While the screen is open, the inbox balance drives the arrival →
 * crediting states.
 */
import { inboxWatchRoute } from "@senryo/api-client";
import { readContract, readInboxBalances } from "@senryo/chain";
import type { Address } from "@senryo/core";
import { useQuery } from "@tanstack/react-query";
import { INBOX_REFETCH_MS, INBOX_WATCH_REFRESH_MS } from "./constants.ts";
import { useQueryEnv } from "./env.tsx";
import { keys } from "./keys.ts";
import { readingOf } from "./reading.ts";

export interface InboxState {
  inbox: Address;
  /** AUSD + USDC (usd6) sitting in the inbox, not yet credited. */
  waitingUsd6: bigint;
}

export function useInbox(user: Address | undefined) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: keys.inbox(env.chainId, user ?? "0x"),
    queryFn: async (): Promise<InboxState> => {
      if (!user) throw new Error("no account");
      const inbox = await readContract(env.chainId, "InboxFactory", env.read).read.inboxOf([user]);
      const balances = await readInboxBalances(env.read, env.chainId, [inbox]);
      const waitingUsd6 = balances.get(inbox);
      if (waitingUsd6 === undefined) throw new Error("inbox balance unavailable");
      return { inbox, waitingUsd6 };
    },
    enabled: user !== undefined,
    refetchInterval: INBOX_REFETCH_MS,
  });
  return readingOf(query, INBOX_REFETCH_MS);
}

/**
 * Registers the inbox with the api so the keeper credits a first deposit. It's idempotent and re-sent every
 * INBOX_WATCH_REFRESH_MS while the screen is open. If the api's `inboxOf` disagrees with ours, that's an error, never
 * a silent switch to its address.
 */
export function useInboxWatch(user: Address | undefined, inbox: Address | undefined) {
  const env = useQueryEnv();
  return useQuery({
    queryKey: [...keys.inbox(env.chainId, user ?? "0x"), "watch"] as const,
    queryFn: async () => {
      if (!user || !inbox) throw new Error("no inbox");
      const watch = await env.api.call(inboxWatchRoute, { body: { chainId: env.chainId, user } });
      if (watch.inbox.toLowerCase() !== inbox.toLowerCase()) throw new Error("the api reports a different inbox");
      return watch;
    },
    enabled: user !== undefined && inbox !== undefined,
    staleTime: INBOX_WATCH_REFRESH_MS,
    refetchInterval: INBOX_WATCH_REFRESH_MS,
  });
}
