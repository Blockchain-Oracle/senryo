"use client";

/**
 * Who is looking at Social, and whether the api knows it yet (the phone's `useSessionGate`). Public reads (Global feed,
 * the board, a profile) need nothing. Reads and writes about *you* — the Following feed, follow — need an api session:
 * brought up at once while trading is unlocked (in scope, nothing is asked), and only on the person's own tap while it
 * is locked — opening a page never raises the passkey.
 */
import type { Address } from "@senryo/account";
import { type SessionRunner, socialKeys, useQueryEnv } from "@senryo/query";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "@/lib/account/provider";
import { useSessionRunner } from "@/lib/account/use-session-runner";

const SESSION_CHECK_STALE_MS = 300_000;

export type GateStatus = "guest" | "locked" | "pending" | "ready" | "failed";

export interface SessionGate {
  status: GateStatus;
  address: Address | undefined;
  session: SessionRunner | undefined;
  /** Bring the session up now (the person asked): one passkey prompt when trading is locked. */
  open: () => void;
}

export function useSessionGate(): SessionGate {
  const account = useAccount();
  const env = useQueryEnv();
  const client = useQueryClient();
  const session = useSessionRunner();
  const address = account.hint?.address;
  const unlocked = account.snapshot.status === "unlocked";
  const query = useQuery({
    queryKey: ["social-session", env.chainId, (address ?? "0x").toLowerCase()] as const,
    queryFn: async () => {
      if (!session) throw new Error("no account");
      await session(() => Promise.resolve());
      void client.invalidateQueries({ queryKey: socialKeys.chain(env.chainId) });
      return true;
    },
    enabled: session !== undefined && unlocked,
    staleTime: SESSION_CHECK_STALE_MS,
    retry: false,
  });
  let status: GateStatus;
  if (account.status === "loading") status = "pending";
  else if (!address || !session) status = "guest";
  else if (query.data === true) status = "ready";
  else if (query.isFetching) status = "pending";
  else if (query.isError) status = "failed";
  else status = unlocked ? "pending" : "locked";
  return { status, address, session, open: () => void query.refetch() };
}
