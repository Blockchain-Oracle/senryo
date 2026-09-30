/**
 * Account reads (specs/client.md "Data flow"): buckets at `finalized` (money truth) and `latest` (optimistic display),
 * positions at `latest`, native gas balance. The engine socket invalidates `["account", chain, addr]` on every
 * finalized change; the interval refetch is the fallback while the socket is down.
 */
import { type AccountSnapshot, type PositionView, readAccountSnapshot, readPositions } from "@senryo/chain";
import { type AccountRiskView, type Address, fromQuery, type Reading } from "@senryo/core";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { ACCOUNT_REFETCH_MS, GAS_REFETCH_MS } from "./constants.ts";
import { type QueryEnv, useQueryEnv } from "./env.tsx";
import { keys } from "./keys.ts";

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
  return fromQuery(query);
}

export function usePositions(address: Address | undefined): Reading<PositionView[]> {
  const env = useQueryEnv();
  const query = useQuery({ ...positionsOptions(env, address ?? "0x"), enabled: address !== undefined });
  return fromQuery(query);
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
  return fromQuery(query);
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
