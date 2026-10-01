/**
 * Account reads (specs/client.md "Data flow"): buckets at `finalized` (money truth) and `latest` (optimistic display),
 * positions at `latest`, native gas balance. The engine socket invalidates `["account", chain, addr]` on every
 * finalized change; the interval refetch is the fallback while the socket is down.
 */
import { type AccountSnapshot, type PositionView, readAccountSnapshot, readPositions } from "@senryo/chain";
import type { AccountRiskView, Address, Reading } from "@senryo/core";
import { ActivityDocument, activityVars, type EquityCurve, EquityDocument, equityVars } from "@senryo/indexer-client";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { ACCOUNT_REFETCH_MS, EQUITY_REFETCH_MS, GAS_REFETCH_MS } from "./constants.ts";
import { type QueryEnv, useQueryEnv } from "./env.tsx";
import { keys } from "./keys.ts";
import { readingOf } from "./reading.ts";

export const accountRiskOptions = (env: QueryEnv, address: Address, tag: "latest" | "finalized") =>
  queryOptions({
    queryKey: keys.accountRisk(env.chainId, address, tag),
    queryFn: () => readAccountSnapshot(env.read, env.chainId, address, tag),
    refetchInterval: ACCOUNT_REFETCH_MS,
    staleTime: ACCOUNT_REFETCH_MS,
  });

export const positionsOptions = (env: QueryEnv, address: Address) =>
  queryOptions({
    queryKey: keys.positions(env.chainId, address),
    queryFn: async () => {
      const snapshot = await readAccountSnapshot(env.read, env.chainId, address, "latest");
      return readPositions(env.read, env.chainId, address, snapshot.positionBitmap, "latest");
    },
    refetchInterval: ACCOUNT_REFETCH_MS,
    staleTime: ACCOUNT_REFETCH_MS,
  });

/** Buckets: `finalized` for anything that decides money, `latest` for the optimistic row after a fill. */
export function useAccountRisk(
  address: Address | undefined,
  tag: "latest" | "finalized" = "finalized",
): Reading<AccountSnapshot> {
  const env = useQueryEnv();
  const query = useQuery({
    ...accountRiskOptions(env, address ?? "0x", tag),
    enabled: address !== undefined,
  });
  return readingOf(query, ACCOUNT_REFETCH_MS);
}

export function usePositions(address: Address | undefined): Reading<PositionView[]> {
  const env = useQueryEnv();
  const query = useQuery({ ...positionsOptions(env, address ?? "0x"), enabled: address !== undefined });
  return readingOf(query, ACCOUNT_REFETCH_MS);
}

export function useGasBalance(address: Address | undefined): Reading<bigint> {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: keys.gas(env.chainId, address ?? "0x"),
    queryFn: () => env.read.getBalance({ address: address ?? "0x", blockTag: "latest" }),
    enabled: address !== undefined,
    refetchInterval: GAS_REFETCH_MS,
    staleTime: GAS_REFETCH_MS,
  });
  return readingOf(query, GAS_REFETCH_MS);
}

/** The preview's view of an account snapshot (`atRisk` switches the safety buffer on, as in `RiskModule._risk`). */
export function riskViewOf(s: AccountSnapshot): AccountRiskView {
  return {
    equityLiq: s.equityLiq,
    mm: s.mm,
    freeToTrade: s.freeToTrade,
    atRisk: s.positionBitmap !== 0 || s.holds > 0n || s.envelope > 0n || s.cardDebt > 0n,
  };
}

const MS_PER_SECOND = 1000;

/**
 * Equity curve over the last `windowSec` from indexed `AccountRiskUpdated` snapshots (portfolio chart + 24 h change).
 * The key holds the window, not a timestamp, so it stays stable across renders.
 */
export function useEquityHistory(address: Address | undefined, windowSec: number): Reading<EquityCurve> {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: [...keys.account(env.chainId, address ?? "0x"), "equity", windowSec] as const,
    queryFn: ({ signal }) => {
      const since = Math.floor(Date.now() / MS_PER_SECOND) - windowSec;
      return env.indexer.request(
        EquityDocument,
        equityVars({ chainId: env.chainId, user: address ?? "0x" }, { since }),
        signal,
      );
    },
    enabled: address !== undefined,
    refetchInterval: EQUITY_REFETCH_MS,
    staleTime: EQUITY_REFETCH_MS,
  });
  return readingOf(query, EQUITY_REFETCH_MS);
}

/**
 * Money moved in or out of the account (not trading): deposits — claims, vouchers and arrivals included, since each
 * lands as a deposit — withdrawals and sends, card spending and refunds. Their indexed amounts are already signed
 * changes of the balance (usd6).
 */
const FLOW_KINDS = ["DEPOSIT", "WITHDRAW", "CARD_CAPTURE", "CARD_REFUND"] as const;
/** More movements than this in one window is not a phone's account; the sum stops there. */
const FLOWS_LIMIT = 500;

export interface NetFlows {
  /** Signed total (usd6): positive when more came in than went out. */
  net: bigint;
  /** What came in (usd6), for a change's percentage base. */
  inflow: bigint;
}

/** The account's money movements strictly after `afterSec` (unix seconds), summed; `afterSec` undefined waits. */
export function useNetFlows(address: Address | undefined, afterSec: number | undefined): Reading<NetFlows> {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: [...keys.account(env.chainId, address ?? "0x"), "flows", afterSec ?? 0] as const,
    queryFn: async ({ signal }): Promise<NetFlows> => {
      const rows = await env.indexer.request(
        ActivityDocument,
        activityVars(
          { chainId: env.chainId, user: address ?? "0x" },
          { after: afterSec ?? 0, kinds: FLOW_KINDS, limit: FLOWS_LIMIT },
        ),
        signal,
      );
      let net = 0n;
      let inflow = 0n;
      for (const row of rows) {
        const amount = row.amount ?? 0n;
        net += amount;
        if (amount > 0n) inflow += amount;
      }
      return { net, inflow };
    },
    enabled: address !== undefined && afterSec !== undefined,
    refetchInterval: EQUITY_REFETCH_MS,
    staleTime: EQUITY_REFETCH_MS,
  });
  return readingOf(query, EQUITY_REFETCH_MS);
}
