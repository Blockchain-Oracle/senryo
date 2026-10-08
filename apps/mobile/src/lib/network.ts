/**
 * The selected network (S8.22, F06/F49, D-172): Practice (test dollars, Monad testnet) or Real (USDC, Monad mainnet).
 * A module-level store persisted in MMKV — React reads it with `useNetwork()`, non-React code (the sender, the policy
 * context, the API session) with `activeNetwork()` — so one switch re-points everything at once. Fresh installs start
 * in Practice. Real is always selectable; calls on it open only when the 143 address book has the market contracts.
 */
import { marketsDeployed } from "@senryo/chain";
import { MAINNET, MAINNET_CHAIN_ID, type NetworkConfig, TESTNET } from "@senryo/config";
import { useSyncExternalStore } from "react";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { DEV_WORKSPACE } from "./dev/config";

export type NetworkKey = NetworkConfig["key"];

let current: NetworkConfig =
  !DEV_WORKSPACE && storage.getString(STORAGE_KEYS.network) === MAINNET.key ? MAINNET : TESTNET;
const listeners = new Set<() => void>();

export function activeNetwork(): NetworkConfig {
  return current;
}

export function setActiveNetwork(key: NetworkKey): void {
  if (DEV_WORKSPACE && key !== "testnet")
    throw new Error("The development workspace only supports the local Practice fork.");
  const next = key === MAINNET.key ? MAINNET : TESTNET;
  if (next === current) return;
  current = next;
  storage.set(STORAGE_KEYS.network, next.key);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useNetwork(): NetworkConfig {
  return useSyncExternalStore(subscribe, activeNetwork, activeNetwork);
}

/** Real money needs the prediction-market contracts on mainnet in the address book (S9, D-256). */
export function realMoneyLive(): boolean {
  return marketsDeployed(MAINNET_CHAIN_ID);
}

/** The selected network can't take calls yet: Real before launch shows live prices read-only. */
export function useReadOnlyNetwork(): boolean {
  const network = useNetwork();
  return network.key === MAINNET.key && !realMoneyLive();
}
