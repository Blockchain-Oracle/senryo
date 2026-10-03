"use client";

/**
 * The open deposit address issued per route (flow book B4 step 4; the phone's `deposit-addresses.ts`), kept in this
 * browser per network and account: Relay's open mode takes later and different-sized deposits of the same route, so
 * reopening the route — after a reload too — shows the same address and its timeline instead of opening a new one.
 * The record and its rules are `@senryo/query`'s (`deposit-addresses.ts`), shared with the phone.
 */
import type { BridgeDepositAddressOk } from "@senryo/api-client";
import {
  findSavedDeposit,
  parseSavedDeposits,
  type SavedDeposit,
  savedDepositOf,
  withSavedDeposit,
} from "@senryo/query";
import { readLocalString, useLocalString, writeLocalString } from "@/lib/account/local-string";
import { MONEY_STORAGE } from "@/lib/constants/money";

export type { SavedDeposit };

/** Keeps the address just issued for its route (replacing an older one of the same route). */
export function saveDeposit(chainId: number, account: string, issued: BridgeDepositAddressOk): SavedDeposit {
  const saved = savedDepositOf(chainId, account, issued, Date.now());
  const list = parseSavedDeposits(readLocalString(MONEY_STORAGE.depositAddresses));
  writeLocalString(MONEY_STORAGE.depositAddresses, JSON.stringify(withSavedDeposit(list, saved)));
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
  const raw = useLocalString(MONEY_STORAGE.depositAddresses);
  if (!account || !remote) return undefined;
  return findSavedDeposit(parseSavedDeposits(raw), { chainId, account, fromChain, asset, remote }, Date.now());
}
