/**
 * Recent recipients (FT058, P22's "recent sends"): the addresses this account sent money to on this network, newest
 * first, from its indexed withdrawals to someone else — so the list follows the account to a new device. A send to
 * the account's own wallet is a withdrawal, not a recipient, and is left out.
 */
import type { Address, Reading } from "@senryo/core";
import { ActivityDocument, activityVars } from "@senryo/indexer-client";
import { useQuery } from "@tanstack/react-query";
import { ACCOUNT_REFETCH_MS } from "./constants.ts";
import { useQueryEnv } from "./env.tsx";
import { keys } from "./keys.ts";
import { readingOf } from "./reading.ts";

/** How many withdrawals are read, and how many distinct recipients are shown. */
const SCAN_ROWS = 60;
const RECIPIENTS_MAX = 6;

export interface RecentRecipient {
  address: string;
  /** The last amount sent to them (usd6) and when (unix seconds). */
  lastAmountUsd6: bigint;
  lastAt: number;
  symbol: string | undefined;
}

export function useRecentRecipients(address: Address | undefined): Reading<RecentRecipient[]> {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: [...keys.account(env.chainId, address ?? "0x"), "recipients"] as const,
    queryFn: async ({ signal }): Promise<RecentRecipient[]> => {
      const rows = await env.indexer.request(
        ActivityDocument,
        activityVars({ chainId: env.chainId, user: address ?? "0x" }, { kinds: ["WITHDRAW"], limit: SCAN_ROWS }),
        signal,
      );
      const self = (address ?? "").toLowerCase();
      const seen = new Map<string, RecentRecipient>();
      for (const row of rows) {
        const to = row.move?.counterparty?.toLowerCase();
        if (!to || to === self || seen.has(to)) continue;
        seen.set(to, {
          address: to,
          lastAmountUsd6: row.move?.amount ?? 0n,
          lastAt: row.timestamp,
          symbol: row.move?.symbol ?? undefined,
        });
        if (seen.size >= RECIPIENTS_MAX) break;
      }
      return [...seen.values()];
    },
    enabled: address !== undefined,
    staleTime: ACCOUNT_REFETCH_MS,
  });
  return readingOf(query, ACCOUNT_REFETCH_MS);
}
