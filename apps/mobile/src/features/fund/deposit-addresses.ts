/**
 * The open deposit address issued per route (B4 step 4; routes.md §4), kept on this phone per network and account:
 * Relay's open mode takes later and different-sized deposits of the same route, so reopening the route — after a kill
 * too — shows the same address and its timeline instead of opening a new one. A new address is asked for only when
 * the route has none or its order deadline passed. The record and its rules live in `@senryo/query`
 * (`deposit-addresses.ts`), shared with the web; this module keeps them in MMKV.
 */
import type { BridgeDepositAddressOk } from "@senryo/api-client";
import {
  findSavedDeposit,
  parseSavedDeposits,
  type SavedDeposit,
  savedDepositOf,
  withSavedDeposit,
} from "@senryo/query";
import { useMMKVString } from "react-native-mmkv";
import { STORAGE_KEYS, storage } from "~/lib/storage";

export type { SavedDeposit };

/** Keeps the address just issued for its route (replacing an older one of the same route). */
export function saveDeposit(
  chainId: number,
  account: string,
  issued: BridgeDepositAddressOk,
  source?: { sourceName: string; sourceMark: string; issuedWhileAway?: boolean },
): SavedDeposit {
  const saved = { ...savedDepositOf(chainId, account, issued, Date.now()), ...source };
  const list = parseSavedDeposits(storage.getString(STORAGE_KEYS.depositAddresses));
  storage.set(STORAGE_KEYS.depositAddresses, JSON.stringify(withSavedDeposit(list, saved)));
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
  return findSavedDeposit(parseSavedDeposits(raw), { chainId, account, fromChain, asset, remote }, Date.now());
}

/** Saved routes remain reachable after quote expiry and while money is unresolved. */
export function useSavedDeposits(
  chainId: number,
  account: string | undefined,
  fromChain: number,
  asset: string,
  remote: string | undefined,
) {
  const [raw] = useMMKVString(STORAGE_KEYS.depositAddresses, storage);
  return parseSavedDeposits(raw).filter(
    (d) =>
      d.chainId === chainId &&
      d.account === account?.toLowerCase() &&
      d.fromChain === fromChain &&
      d.asset === asset &&
      d.remote === remote,
  );
}
