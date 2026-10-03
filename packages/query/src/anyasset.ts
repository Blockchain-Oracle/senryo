/**
 * The any-asset hooks (D6/D2): holdings of any token, any ↔ any swap quotes, and cross-chain routes / quotes /
 * status — all served by services/api (`/v1/holdings`, `/v1/swap/quote`, `/v1/bridge/*`). Each returns a `Reading<T>`
 * (never a fake zero), plus the B4 deposit address (`/v1/bridge/deposit-address`, `/deposit-status`); the send helpers turn a reviewed quote into the account's `TxRequest`s through `@senryo/chain`,
 * which refuses any router or bridge contract that isn't pinned in `@senryo/config`.
 */
import {
  type BridgeDepositAddressResponse,
  type BridgeDepositStatus,
  type BridgeQuoteOk,
  type BridgeQuoteResponse,
  type BridgeRoutes,
  type BridgeStatus,
  bridgeDepositAddressRoute,
  bridgeDepositStatusRoute,
  bridgeQuoteRoute,
  bridgeRoutesRoute,
  bridgeStatusRoute,
  type Holdings,
  holdingsRoute,
  type SwapQuoteOk,
  type SwapQuoteResponse,
  swapQuoteRoute,
  WALLET_ACTIVITY_PAGE,
  type WalletActivityItem,
  walletActivityRoute,
} from "@senryo/api-client";
import {
  type PrepareAggregatorSwapOptions,
  type PrepareBridgeOptions,
  prepareAggregatorSwap,
  prepareBridgeSends,
  type TxRequest,
} from "@senryo/chain";
import {
  type BridgeAsset,
  type BridgeProvider,
  type ChainId,
  MAINNET_CHAIN_ID,
  type RemoteAsset,
  SWAP_SLIPPAGE_BPS,
} from "@senryo/config";
import type { Address, Reading } from "@senryo/core";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  BRIDGE_QUOTE_REFETCH_MS,
  BRIDGE_ROUTES_STALE_MS,
  BRIDGE_STATUS_REFETCH_MS,
  HOLDINGS_REFETCH_MS,
  SWAP_QUOTE_REFETCH_MS,
  WALLET_ACTIVITY_REFETCH_MS,
} from "./constants.ts";
import { type QueryEnv, useQueryEnv } from "./env.tsx";
import { keys } from "./keys.ts";
import { readingOf } from "./reading.ts";
import { mainnetReadOf } from "./spot.ts";

export const anyAssetKeys = {
  /** Under the account key: a finalized account invalidation refreshes the holdings. */
  holdings: (chainId: ChainId, address: Address) => [...keys.account(chainId, address), "holdings"] as const,
  walletActivity: (chainId: ChainId, address: Address) =>
    [...keys.account(chainId, address), "wallet-activity"] as const,
  swapQuote: (chainId: ChainId, p: SwapQuoteParams) =>
    [
      "swap",
      chainId,
      "quote",
      p.from,
      p.to,
      p.amount.toString(),
      p.sender,
      p.slippageBps ?? SWAP_SLIPPAGE_BPS,
    ] as const,
  bridgeRoutes: (chainId: ChainId, asset: BridgeAsset, direction: "out" | "in") =>
    ["bridge", chainId, "routes", asset, direction] as const,
  bridgeQuote: (p: BridgeQuoteParams) =>
    [
      "bridge",
      "quote",
      p.fromChain,
      p.toChain,
      p.asset,
      p.amount.toString(),
      p.sender,
      p.recipient,
      p.remote ?? "",
      p.provider ?? "",
    ] as const,
  bridgeStatus: (r: BridgeStatusRef) => ["bridge", "status", r.route, r.id, r.fromChain, r.toChain ?? ""] as const,
  depositStatus: (r: DepositAddressRef) => ["bridge", "deposit-status", r.fromChain, r.depositAddress] as const,
};

/**
 * Every token `address` holds on `chainId` (default: the active network) — verified first by value, then "Other
 * tokens"; prices on Mainnet only. The api caches ~20 s per address; the screen re-reads at that pace.
 */
export function useHoldings(address: Address | undefined, chainId?: ChainId): Reading<Holdings> {
  const env = useQueryEnv();
  const network = chainId ?? env.chainId;
  const query = useQuery({
    queryKey: anyAssetKeys.holdings(network, address ?? "0x"),
    queryFn: ({ signal }) =>
      env.api.call(holdingsRoute, { query: { chainId: network, address: address as Address } }, { signal }),
    enabled: address !== undefined,
    staleTime: HOLDINGS_REFETCH_MS,
    refetchInterval: HOLDINGS_REFETCH_MS,
  });
  return readingOf(query, HOLDINGS_REFETCH_MS);
}

/**
 * Wallet movements for Activity (B12, D8): tokens and MON received from anyone, sent anywhere and swapped anywhere —
 * `/v1/activity/wallet`, one item per transaction, newest first, a page at a time by its own cursor. Under the account
 * key, so a finalized operation's account invalidation refreshes it; while it is shown it re-reads at the api's rescan
 * pace, so money that arrives from outside appears without any action.
 */
export function useWalletActivity(address: Address | undefined, enabled: boolean) {
  const env = useQueryEnv();
  const query = useInfiniteQuery({
    queryKey: anyAssetKeys.walletActivity(env.chainId, address ?? "0x"),
    queryFn: ({ pageParam, signal }) =>
      env.api.call(
        walletActivityRoute,
        {
          query: {
            chainId: env.chainId,
            address: address as Address,
            limit: WALLET_ACTIVITY_PAGE,
            ...(pageParam ? { before: pageParam } : {}),
          },
        },
        { signal },
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next ?? undefined,
    enabled: enabled && address !== undefined,
    staleTime: WALLET_ACTIVITY_REFETCH_MS,
    refetchInterval: WALLET_ACTIVITY_REFETCH_MS,
  });
  const items: WalletActivityItem[] | undefined = query.data?.pages.flatMap((p) => p.items);
  return {
    items,
    /** The wallet source can't be read: Activity goes on without it (the indexer and the journal still show). */
    failed: query.isError && query.data === undefined,
    hasMore: query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
    refetch: () => query.refetch(),
  };
}

export interface SwapQuoteParams {
  /** `0x000…000` for native MON. */
  from: Address;
  to: Address;
  /** Raw base units of `from`. */
  amount: bigint;
  /** The account that will send the swap (the calldata is built for it). */
  sender: Address;
  slippageBps?: number | undefined;
}

/**
 * Any ↔ any quote on the active network (Practice answers `status: "unsupported"`), re-quoted while the ticket is
 * open. `quote.impact` is the rule's verdict (warn > 1 %, block > 5 %). Re-quote right before signing: routes through
 * an order book (Kuru) go stale within a few blocks.
 */
export function useSwapQuote(params: SwapQuoteParams | undefined): Reading<SwapQuoteResponse> {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: params ? anyAssetKeys.swapQuote(env.chainId, params) : ["swap", env.chainId, "quote", "none"],
    queryFn: ({ signal }) => {
      const p = params as SwapQuoteParams;
      return env.api.call(
        swapQuoteRoute,
        {
          query: {
            chainId: env.chainId,
            from: p.from,
            to: p.to,
            amount: p.amount,
            sender: p.sender,
            slippageBps: p.slippageBps ?? SWAP_SLIPPAGE_BPS,
          },
        },
        { signal },
      );
    },
    enabled: params !== undefined && params.amount > 0n,
    staleTime: SWAP_QUOTE_REFETCH_MS,
    refetchInterval: SWAP_QUOTE_REFETCH_MS,
  });
  return readingOf(query, SWAP_QUOTE_REFETCH_MS);
}

/**
 * The ordered sends for a reviewed swap from `owner`'s account: [approve(router, exact)?, router call]. Reads the
 * allowance (or, for native MON, keeps the 10 MON reserve plus `gasCostWei`) now; throws `UnpinnedTargetError` /
 * `MonReserveError` from `@senryo/chain`. Mainnet only (aggregators don't serve Practice).
 */
export function aggregatorSwapRequests(
  env: QueryEnv,
  owner: Address,
  quote: SwapQuoteOk,
  options: PrepareAggregatorSwapOptions = {},
): Promise<TxRequest[]> {
  return prepareAggregatorSwap(
    mainnetReadOf(env),
    owner,
    { ...quote.quote, tokenIn: quote.from.address, amountIn: quote.amountIn },
    options,
  );
}

/** Which chains `asset` can go to (`out`) or come from (`in`) on the active network — the chain picker. */
export function useBridgeRoutes(asset: BridgeAsset | undefined, direction: "out" | "in"): Reading<BridgeRoutes> {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: anyAssetKeys.bridgeRoutes(env.chainId, asset ?? "USDC", direction),
    queryFn: ({ signal }) =>
      env.api.call(
        bridgeRoutesRoute,
        { query: { chainId: env.chainId, asset: asset as BridgeAsset, direction } },
        { signal },
      ),
    enabled: asset !== undefined,
    staleTime: BRIDGE_ROUTES_STALE_MS,
  });
  return readingOf(query);
}

export interface BridgeQuoteParams {
  fromChain: number;
  toChain: number;
  asset: BridgeAsset;
  amount: bigint;
  sender: Address;
  recipient: string;
  remote?: RemoteAsset | undefined;
  provider?: BridgeProvider | undefined;
}

/** The best route for a transfer (every listed provider asked), re-quoted while the review is open. */
export function useBridgeQuote(params: BridgeQuoteParams | undefined): Reading<BridgeQuoteResponse> {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: params ? anyAssetKeys.bridgeQuote(params) : ["bridge", "quote", "none"],
    queryFn: ({ signal }) => {
      const p = params as BridgeQuoteParams;
      return env.api.call(
        bridgeQuoteRoute,
        {
          query: {
            fromChain: p.fromChain,
            toChain: p.toChain,
            asset: p.asset,
            amount: p.amount,
            sender: p.sender,
            recipient: p.recipient,
            ...(p.remote ? { remote: p.remote } : {}),
            ...(p.provider ? { provider: p.provider } : {}),
          },
        },
        { signal },
      );
    },
    enabled: params !== undefined && params.amount > 0n && params.recipient.length > 0,
    staleTime: BRIDGE_QUOTE_REFETCH_MS,
    refetchInterval: BRIDGE_QUOTE_REFETCH_MS,
  });
  return readingOf(query, BRIDGE_QUOTE_REFETCH_MS);
}

/**
 * The Monad sends of a reviewed bridge quote: [approve(exact)?, provider call] with pinned targets; a step for another
 * chain is refused (inbound transfers are signed by the sender's wallet there). Keeps the MON reserve when a step sends
 * MON value (a native-MON deposit, LI.FI's MON-paid bridge fee); compose such steps first in a larger operation.
 */
export function bridgeSendRequests(
  env: QueryEnv,
  owner: Address,
  quote: BridgeQuoteOk,
  options: PrepareBridgeOptions = {},
): Promise<TxRequest[]> {
  const chainId = quote.direction === "out" ? quote.fromChain : quote.toChain;
  const read = chainId === MAINNET_CHAIN_ID ? mainnetReadOf(env) : env.read;
  return prepareBridgeSends(read, chainId as ChainId, owner, quote.steps, {
    ...options,
    meta: { provider: quote.provider, asset: quote.asset, ...options.meta },
  });
}

export interface BridgeStatusRef {
  route: BridgeProvider;
  /** Relay request id, or the source tx hash for CCTP / Across / LI.FI. */
  id: string;
  fromChain: number;
  toChain?: number | undefined;
}

const TERMINAL: ReadonlySet<BridgeStatus["state"]> = new Set(["delivered", "refunded", "failed"]);

/** Delivery state of a sent transfer, polled until it is delivered, refunded or failed. */
export function useBridgeStatus(ref: BridgeStatusRef | undefined): Reading<BridgeStatus> {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: ref ? anyAssetKeys.bridgeStatus(ref) : ["bridge", "status", "none"],
    queryFn: ({ signal }) => {
      const r = ref as BridgeStatusRef;
      return env.api.call(
        bridgeStatusRoute,
        {
          query: {
            route: r.route,
            id: r.id,
            fromChain: r.fromChain,
            ...(r.toChain === undefined ? {} : { toChain: r.toChain }),
          },
        },
        { signal },
      );
    },
    enabled: ref !== undefined,
    refetchInterval: (q) => (q.state.data && TERMINAL.has(q.state.data.state) ? false : BRIDGE_STATUS_REFETCH_MS),
  });
  return readingOf(query, BRIDGE_STATUS_REFETCH_MS);
}

export interface DepositAddressParams {
  fromChain: number;
  asset: BridgeAsset;
  remote?: RemoteAsset | undefined;
  /** What the user means to send (source base units). */
  amount: bigint;
  /** The user's own Monad wallet. */
  recipient: Address;
}

/**
 * Opens a Relay deposit address on `fromChain` for a transfer into the user's Monad wallet (B4 step 4). Not a polled
 * query: every call opens a new address, so the caller keeps the one it got (open mode takes later deposits of the
 * same route) and asks again only for another route.
 */
export function requestDepositAddress(env: QueryEnv, p: DepositAddressParams): Promise<BridgeDepositAddressResponse> {
  return env.api.call(bridgeDepositAddressRoute, {
    body: {
      fromChain: p.fromChain,
      toChain: env.chainId,
      asset: p.asset,
      amount: p.amount,
      recipient: p.recipient,
      ...(p.remote ? { remote: p.remote } : {}),
    },
  });
}

export interface DepositAddressRef {
  fromChain: number;
  depositAddress: string;
}

/** Every deposit seen at an open deposit address, polled while the screen is open (the address stays usable). */
export function useDepositStatus(ref: DepositAddressRef | undefined): Reading<BridgeDepositStatus> {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: ref ? anyAssetKeys.depositStatus(ref) : ["bridge", "deposit-status", "none"],
    queryFn: ({ signal }) => {
      const r = ref as DepositAddressRef;
      return env.api.call(
        bridgeDepositStatusRoute,
        { query: { fromChain: r.fromChain, depositAddress: r.depositAddress } },
        { signal },
      );
    },
    enabled: ref !== undefined,
    refetchInterval: BRIDGE_STATUS_REFETCH_MS,
  });
  return readingOf(query, BRIDGE_STATUS_REFETCH_MS);
}
