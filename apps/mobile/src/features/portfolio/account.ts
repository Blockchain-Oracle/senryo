import type { AccountSnapshot } from "@senryo/chain";
import { keys, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount } from "~/lib/account/provider";

/**
 * Locked, as Home and Balance details show it: what the risk-adjusted balance holds back from new trades (margin,
 * card holds or the envelope, the safety buffer) — the balance less Free to trade, never below zero.
 */
export function lockedOf(snapshot: AccountSnapshot): bigint {
  const locked = snapshot.equityInit - snapshot.freeToTrade;
  return locked > 0n ? locked : 0n;
}

/** Refetches every read under this account (balance, positions, history, triggers): the retry of a failed section. */
export function useAccountRetry(): () => void {
  const env = useQueryEnv();
  const client = useQueryClient();
  const address = useAccount().hint?.address;
  return () => {
    if (address) void client.invalidateQueries({ queryKey: keys.account(env.chainId, address) });
  };
}
