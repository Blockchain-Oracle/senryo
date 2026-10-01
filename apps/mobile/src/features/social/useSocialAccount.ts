/**
 * Who is looking at Social (J8, S1b.14), and whether the api knows it yet.
 *
 * Public reads (Global feed, the board, a profile) need nothing. Reads about *you* — the Friends feed, "Your rank",
 * who you follow, what you liked — need an api session, and the hooks with `auth: "optional"` only carry a token that
 * already exists. `useSessionGate` brings that session up: at once while trading is unlocked (signing in is in scope,
 * so nothing is asked), and only on the person's own tap while it is locked — opening a tab never raises Face ID.
 * Once the session exists, the network's social reads are refetched so they come back with the token.
 */
import type { Address } from "@senryo/account";
import { type SessionRunner, socialKeys, useQueryEnv } from "@senryo/query";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "~/lib/account/provider";
import { useSessionRunner } from "~/lib/account/use-session-runner";

/** How long a confirmed session is taken as given before it is checked again (a check costs nothing while it lasts). */
const SESSION_CHECK_STALE_MS = 300_000;

export interface SocialAccount {
  /** The account store has answered: `guest` is only meaningful once this is true. */
  ready: boolean;
  /** No account on this phone. */
  guest: boolean;
  address: Address | undefined;
  session: SessionRunner | undefined;
}

export function useSocialAccount(): SocialAccount {
  const account = useAccount();
  const session = useSessionRunner();
  return {
    ready: account.ready,
    guest: account.ready && !account.hint,
    address: account.hint?.address,
    session,
  };
}

/**
 * `guest` no account · `locked` trading is locked and no session was asked for yet · `pending` · `ready` ·
 * `failed` the sign-in was cancelled or refused.
 */
export type GateStatus = "guest" | "locked" | "pending" | "ready" | "failed";

export interface SessionGate extends SocialAccount {
  status: GateStatus;
  /** Bring the session up now (the person asked): unlocks with one prompt when trading is locked. */
  open: () => void;
}

export function useSessionGate(): SessionGate {
  const who = useSocialAccount();
  const account = useAccount();
  const env = useQueryEnv();
  const client = useQueryClient();
  const { session, address } = who;
  const unlocked = account.snapshot.status === "unlocked";
  const query = useQuery({
    queryKey: ["social-session", env.chainId, (address ?? "0x").toLowerCase()] as const,
    queryFn: async () => {
      if (!session) throw new Error("no account");
      await session(() => Promise.resolve());
      // Reads that only carry a token when one exists (liked by me, Your rank) come back with it now.
      void client.invalidateQueries({ queryKey: socialKeys.chain(env.chainId) });
      return true;
    },
    enabled: session !== undefined && unlocked,
    staleTime: SESSION_CHECK_STALE_MS,
    retry: false,
  });
  let status: GateStatus;
  if (!who.ready) status = "pending";
  else if (who.guest || !session) status = "guest";
  else if (query.data === true) status = "ready";
  else if (query.isFetching) status = "pending";
  else if (query.isError) status = "failed";
  else status = unlocked ? "pending" : "locked";
  return { ...who, status, open: () => void query.refetch() };
}
