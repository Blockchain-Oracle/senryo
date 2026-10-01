/**
 * The selected network (S8.22, F06/F49, D-172): Practice (paper money, Monad testnet) or Mainnet (real money).
 * A module-level store persisted in MMKV — React reads it with `useNetwork()`, non-React code (the sender, the policy
 * context, the API session) with `activeNetwork()` — so one switch re-points everything at once. Fresh installs start
 * in Practice. Mainnet is always selectable; trading on it opens only when this build bundles the 143 address book.
 */
import { isDeployed } from "@senryo/chain";
import { MAINNET, MAINNET_CHAIN_ID, type NetworkConfig, TESTNET } from "@senryo/config";
import { useSyncExternalStore } from "react";
import { STORAGE_KEYS, storage } from "~/lib/storage";

export type NetworkKey = NetworkConfig["key"];

let current: NetworkConfig = storage.getString(STORAGE_KEYS.network) === MAINNET.key ? MAINNET : TESTNET;
const listeners = new Set<() => void>();

export function activeNetwork(): NetworkConfig {
  return current;
}

export function setActiveNetwork(key: NetworkKey): void {
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

/** Real-money trading needs the mainnet contracts in this build (a new binary after the S8.18 deploy). */
export function mainnetTradingLive(): boolean {
  return isDeployed(MAINNET_CHAIN_ID, "SenryoCore");
}

/** The selected network can't trade yet: Mainnet before launch shows live prices read-only. */
export function useReadOnlyNetwork(): boolean {
  const network = useNetwork();
  return network.key === MAINNET.key && !mainnetTradingLive();
}
