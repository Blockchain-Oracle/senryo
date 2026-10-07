/** Selected-network Perpl account, position and order-term reads. Cache keys include the deployment chain. */
import {
  type PerplExchangeState,
  type PerplMarketTerms,
  type PerplPosition,
  type PerplSnapshot,
  type ReadClient,
  readPerplExchange,
  readPerplLeverageCaps,
  readPerplMarketTerms,
  readPerplSnapshot,
} from "@senryo/chain";
import { type ChainId, PERPL_MARKETS } from "@senryo/config";
import type { Address, Reading } from "@senryo/core";
import { useQuery } from "@tanstack/react-query";
import { PERPL_ACCOUNT_REFETCH_MS, PERPL_CAPS_REFETCH_MS, PERPL_TERMS_REFETCH_MS } from "./constants.ts";
import { type QueryEnv, useQueryEnv } from "./env.tsx";
import { keys } from "./keys.ts";
import { readingOf } from "./reading.ts";
import { mainnetReadOf } from "./spot.ts";

function usePerplSnapshotQuery<T>(address: Address | undefined, select: (s: PerplSnapshot) => T) {
  const env = useQueryEnv();
  const chainId = env.chainId;
  return useQuery({
    queryKey: keys.perpl(address ?? "0x", chainId),
    queryFn: () => readPerplSnapshot(perplReadOf(env), chainId, address as Address),
    enabled: address !== undefined,
    refetchInterval: PERPL_ACCOUNT_REFETCH_MS,
    staleTime: PERPL_ACCOUNT_REFETCH_MS,
    select,
  });
}

/**
 * The wallet's Perpl picture at the finalized head: the account (undefined until the first deposit creates it — not an
 * error), its free/locked collateral, the open positions and the wallet's AUSD + allowance for the Exchange.
 */
export function usePerplAccount(address: Address | undefined): Reading<PerplSnapshot> {
  return readingOf(
    usePerplSnapshotQuery(address, (s) => s),
    PERPL_ACCOUNT_REFETCH_MS,
  );
}

/** Open Perpl positions (entry, size, collateral, the Exchange's own PnL at mark), from the same read. */
export function usePerplPositions(address: Address | undefined): Reading<PerplPosition[]> {
  return readingOf(
    usePerplSnapshotQuery(address, (s) => s.positions),
    PERPL_ACCOUNT_REFETCH_MS,
  );
}

/** Mark, decimals, max leverage and taker fee of one market — what a ticket sizes an order with. */
export function usePerplMarketTerms(marketId: number | undefined): Reading<PerplMarketTerms> {
  const env = useQueryEnv();
  const chainId = env.chainId;
  const query = useQuery({
    queryKey: keys.perplMarket(marketId ?? -1, chainId),
    queryFn: () => readPerplMarketTerms(perplReadOf(env), chainId, marketId as number),
    enabled: marketId !== undefined,
    refetchInterval: PERPL_TERMS_REFETCH_MS,
    staleTime: PERPL_TERMS_REFETCH_MS,
  });
  return readingOf(query, PERPL_TERMS_REFETCH_MS);
}

/** The Exchange's halt flag and account-open minimum (owner-set; read live). */
export function usePerplExchange(): Reading<PerplExchangeState> {
  const env = useQueryEnv();
  const chainId = env.chainId;
  const query = useQuery({
    queryKey: keys.perplExchange(chainId),
    queryFn: () => readPerplExchange(perplReadOf(env), chainId),
    refetchInterval: PERPL_TERMS_REFETCH_MS,
    staleTime: PERPL_TERMS_REFETCH_MS,
  });
  return readingOf(query, PERPL_TERMS_REFETCH_MS);
}

/** Every listed market's base max leverage (hundredths, by market id) in one read — the Markets list's badges. */
export function usePerplLeverageCaps(): Reading<Record<number, bigint>> {
  const env = useQueryEnv();
  const chainId = env.chainId;
  const ids = Object.values(PERPL_MARKETS[chainId] ?? {});
  const query = useQuery({
    queryKey: keys.perplCaps(chainId),
    queryFn: () => readPerplLeverageCaps(perplReadOf(env), chainId, ids),
    refetchInterval: PERPL_CAPS_REFETCH_MS,
    staleTime: PERPL_CAPS_REFETCH_MS,
  });
  return readingOf(query, PERPL_CAPS_REFETCH_MS);
}

/**
 * `CapabilityFacts.perplAccountReady` for `address`: the Exchange answers and isn't halted, and the wallet's account
 * isn't frozen. No account yet is ready — the first open's operation creates it. Undefined while unknown (the
 * capability stays off until the chain says yes).
 */
export function usePerplReady(address: Address | undefined): boolean | undefined {
  const env = useQueryEnv();
  const chainId = env.chainId;
  const exchange = useQuery({
    queryKey: keys.perplExchange(chainId),
    queryFn: () => readPerplExchange(perplReadOf(env), chainId),
    refetchInterval: PERPL_TERMS_REFETCH_MS,
    staleTime: PERPL_TERMS_REFETCH_MS,
  });
  const account = usePerplSnapshotQuery(address, (s) => s.account);
  if (address === undefined || !exchange.data || account.status !== "success") return undefined;
  return !exchange.data.halted && (account.data === undefined || account.data.frozen === 0);
}

/** Read the selected Perpl deployment, including a local testnet fork. */
export const perplReadOf = (env: QueryEnv, chainId: ChainId = env.chainId): ReadClient =>
  chainId === env.chainId ? env.read : mainnetReadOf(env);
