/**
 * The open deposit address issued per route (flow book B4 steps 4–5; routes.md §4), the platform-free half shared by
 * the phone and the web: what is kept per network and account (each app stores the list in its own storage), how a
 * route finds its live address, and the timeline a deposit shows. Relay's open mode takes later and different-sized
 * deposits of the same route, so reopening the route — after a kill or a reload too — shows the same address and its
 * timeline instead of opening a new one. A new address is asked for only when the route has none, its order deadline
 * passed, or another amount is typed.
 */
import type { BridgeDeposit, BridgeDepositAddressOk, BridgeDepositStatus } from "@senryo/api-client";

const MS_PER_SECOND = 1000;

export interface SavedDeposit {
  chainId: number;
  account: string;
  fromChain: number;
  asset: string;
  remote: string;
  depositAddress: string;
  /** Source symbol and decimals ("USDC", 6) and what arrives ("AUSD", 6). */
  symbol: string;
  decimals: number;
  outSymbol: string;
  outDecimals: number;
  /** The quote it was issued with (source base units, and the minimum received). */
  amount: string;
  minReceived: string;
  etaSec: number;
  issuedAt: number;
  /** Relay's order deadline (unix s), when it said. */
  expiresAt: number | null;
}

export type DepositRoute = Pick<SavedDeposit, "chainId" | "account" | "fromChain" | "asset" | "remote">;

/** The stored list, tolerant of a missing or damaged value. */
export function parseSavedDeposits(raw: string | null | undefined): SavedDeposit[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? (value as SavedDeposit[]) : [];
  } catch {
    return [];
  }
}

const sameRoute = (a: DepositRoute, b: DepositRoute) =>
  a.chainId === b.chainId &&
  a.account === b.account &&
  a.fromChain === b.fromChain &&
  a.asset === b.asset &&
  a.remote === b.remote;

/** The record of an address just issued for its route. */
export function savedDepositOf(
  chainId: number,
  account: string,
  issued: BridgeDepositAddressOk,
  issuedAt: number,
): SavedDeposit {
  return {
    chainId,
    account: account.toLowerCase(),
    fromChain: issued.fromChain,
    asset: issued.asset,
    remote: issued.remote.asset,
    depositAddress: issued.depositAddress,
    symbol: issued.remote.symbol,
    decimals: issued.remote.decimals,
    outSymbol: issued.out.symbol,
    outDecimals: issued.out.decimals,
    amount: issued.amountIn.toString(),
    minReceived: issued.minReceived.toString(),
    etaSec: issued.etaSec,
    issuedAt,
    expiresAt: issued.addressExpiresAt,
  };
}

/** The list with `saved` kept for its route (an older address of the same route is replaced). */
export function withSavedDeposit(list: readonly SavedDeposit[], saved: SavedDeposit): SavedDeposit[] {
  return [...list.filter((d) => !sameRoute(d, saved)), saved];
}

/** This route's live address, if one was issued and its order hasn't expired. */
export function findSavedDeposit(
  list: readonly SavedDeposit[],
  route: DepositRoute,
  nowMs: number,
): SavedDeposit | undefined {
  const key = { ...route, account: route.account.toLowerCase() };
  const found = list.find((d) => sameRoute(d, key));
  if (!found) return undefined;
  return found.expiresAt !== null && found.expiresAt * MS_PER_SECOND < nowMs ? undefined : found;
}

/** The newest deposit Relay saw at the address since it was issued (older ones belong to earlier sends). */
export function latestDeposit(
  deposits: readonly BridgeDeposit[] | undefined,
  issuedAt: number,
): BridgeDeposit | undefined {
  return deposits?.find((d) => d.updatedAt === null || Date.parse(d.updatedAt) >= issuedAt) ?? deposits?.[0];
}

export type DepositStepState = "done" | "live" | "waiting" | "failed";

export interface DepositStep {
  title: string;
  detail?: string | undefined;
  state: DepositStepState;
}

/**
 * Waiting → Bridging → Arrived on Monad (or Refunded / Didn't arrive with Relay's reason), from what Relay saw at the
 * address. `amountText` words the delivered amount ("9.98 USDC"); `checking` says Relay couldn't be read yet.
 */
export function depositTimeline(
  deposit: Pick<SavedDeposit, "symbol" | "outSymbol" | "outDecimals" | "issuedAt">,
  status: BridgeDepositStatus | undefined,
  chainName: string,
  checking: boolean,
  amountText: (raw: bigint, decimals: number, symbol: string) => string,
): DepositStep[] {
  const last = latestDeposit(status?.deposits, deposit.issuedAt);
  const state = last?.state;
  const seen = last !== undefined;
  const ended = state === "delivered" || state === "refunded" || state === "failed";
  const arrivedOut = last?.amountOut ?? null;
  return [
    {
      title: seen ? `${deposit.symbol} received on ${chainName}` : `Waiting for ${deposit.symbol}`,
      state: seen ? "done" : "live",
      detail: !seen && checking ? "Checking Relay" : undefined,
    },
    { title: "Bridging", state: !seen ? "waiting" : ended ? (state === "delivered" ? "done" : "failed") : "live" },
    {
      title:
        state === "refunded"
          ? `Refunded on ${chainName}`
          : state === "failed"
            ? "Didn’t arrive"
            : arrivedOut !== null && state === "delivered"
              ? `${amountText(arrivedOut, deposit.outDecimals, deposit.outSymbol)} on Monad`
              : "Arrived on Monad",
      state: state === "delivered" ? "done" : state === "refunded" || state === "failed" ? "failed" : "waiting",
      detail: last?.detail ?? undefined,
    },
  ];
}
