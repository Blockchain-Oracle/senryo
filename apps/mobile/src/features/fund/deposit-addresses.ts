/**
 * The open deposit address issued per route (B4 step 4; routes.md §4), kept on this phone per network and account:
 * Relay's open mode takes later and different-sized deposits of the same route, so reopening the route — after a kill
 * too — shows the same address and its timeline instead of opening a new one. A new address is asked for only when
 * the route has none or its order deadline passed.
 */
import type { BridgeDepositAddressOk } from "@senryo/api-client";
import { useMMKVString } from "react-native-mmkv";
import { STORAGE_KEYS, storage } from "~/lib/storage";

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

function parse(raw: string | undefined): SavedDeposit[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? (value as SavedDeposit[]) : [];
  } catch {
    return [];
  }
}

const sameRoute = (a: Pick<SavedDeposit, "chainId" | "account" | "fromChain" | "asset" | "remote">, b: typeof a) =>
  a.chainId === b.chainId &&
  a.account === b.account &&
  a.fromChain === b.fromChain &&
  a.asset === b.asset &&
  a.remote === b.remote;

/** Keeps the address just issued for its route (replacing an older one of the same route). */
export function saveDeposit(chainId: number, account: string, issued: BridgeDepositAddressOk): SavedDeposit {
  const saved: SavedDeposit = {
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
    issuedAt: Date.now(),
    expiresAt: issued.addressExpiresAt,
  };
  const list = parse(storage.getString(STORAGE_KEYS.depositAddresses)).filter((d) => !sameRoute(d, saved));
  storage.set(STORAGE_KEYS.depositAddresses, JSON.stringify([...list, saved]));
  return saved;
}

/** This route's live address, if one was issued and its order hasn't expired. */
export function useSavedDeposit(
  chainId: number,
  account: string | undefined,
  fromChain: number,
  asset: string,
  remote: string | undefined,
): SavedDeposit | undefined {
  const [raw] = useMMKVString(STORAGE_KEYS.depositAddresses, storage);
  if (!account || !remote) return undefined;
  const route = { chainId, account: account.toLowerCase(), fromChain, asset, remote };
  const found = parse(raw).find((d) => sameRoute(d, route));
  if (!found) return undefined;
  return found.expiresAt !== null && found.expiresAt * MS_PER_SECOND < Date.now() ? undefined : found;
}
