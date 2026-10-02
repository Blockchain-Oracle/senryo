/**
 * Perpl, traded from the user's own wallet on Monad mainnet (D1): the account and its positions read straight from
 * the Exchange (no API key), a market's order terms, and whether the Perpl path is ready for the `perplTrade`
 * capability. Reads go to 143 whichever network is selected (like the spot tokens); keys sit under the mainnet
 * account, so a finalized Perpl send's `keys.account(143, address)` invalidation refreshes them.
 */
import {
  type PerplMarketTerms,
  type PerplPosition,
  type PerplSnapshot,
  readPerplExchange,
  readPerplMarketTerms,
  readPerplSnapshot,
} from "@senryo/chain";
import type { Address, Reading } from "@senryo/core";
import { useQuery } from "@tanstack/react-query";
import { PERPL_ACCOUNT_REFETCH_MS, PERPL_TERMS_REFETCH_MS } from "./constants.ts";
import { useQueryEnv } from "./env.tsx";
import { keys } from "./keys.ts";
import { PERPL_CHAIN_ID } from "./perpl-plan.ts";
import { readingOf } from "./reading.ts";
import { mainnetReadOf } from "./spot.ts";

function usePerplSnapshotQuery<T>(address: Address | undefined, select: (s: PerplSnapshot) => T) {
  const env = useQueryEnv();
  return useQuery({
    queryKey: keys.perpl(address ?? "0x"),
    queryFn: () => readPerplSnapshot(mainnetReadOf(env), PERPL_CHAIN_ID, address as Address),
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
  const query = useQuery({
    queryKey: keys.perplMarket(marketId ?? -1),
    queryFn: () => readPerplMarketTerms(mainnetReadOf(env), PERPL_CHAIN_ID, marketId as number),
    enabled: marketId !== undefined,
    refetchInterval: PERPL_TERMS_REFETCH_MS,
    staleTime: PERPL_TERMS_REFETCH_MS,
  });
  return readingOf(query, PERPL_TERMS_REFETCH_MS);
}

/**
 * `CapabilityFacts.perplAccountReady` for `address`: the Exchange answers and isn't halted, and the wallet's account
 * isn't frozen. No account yet is ready — the first open's operation creates it. Undefined while unknown (the
 * capability stays off until the chain says yes).
 */
export function usePerplReady(address: Address | undefined): boolean | undefined {
  const env = useQueryEnv();
  const exchange = useQuery({
    queryKey: keys.perplExchange(),
    queryFn: () => readPerplExchange(mainnetReadOf(env), PERPL_CHAIN_ID),
    refetchInterval: PERPL_TERMS_REFETCH_MS,
    staleTime: PERPL_TERMS_REFETCH_MS,
  });
  const account = usePerplSnapshotQuery(address, (s) => s.account);
  if (address === undefined || !exchange.data || account.status !== "success") return undefined;
  return !exchange.data.halted && (account.data === undefined || account.data.frozen === 0);
}
