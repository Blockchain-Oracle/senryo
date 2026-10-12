"use client";
/**
 * The web's network, chosen at run time (D-320, F9 — D-172 on the web; the phone's `lib/network.ts`): Practice
 * (testnet, the default) or Real (mainnet), persisted on this device. The app's tree remounts on a switch (the
 * providers key it by the network), so a screen reads `activeNetwork()` while it renders and a call reads it when it
 * runs; balances, positions and history stay per network (every query is keyed by its chain).
 */
import { MAINNET, type NetworkConfig, type NetworkKey, TESTNET } from "@senryo/config";
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "senryo.network.v1";
const NETWORKS: Readonly<Record<NetworkKey, NetworkConfig>> = { testnet: TESTNET, mainnet: MAINNET };
const listeners = new Set<() => void>();
let current: NetworkConfig | null = null;

export function activeNetwork(): NetworkConfig {
  if (current) return current;
  try {
    const saved = typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
    current = saved === "mainnet" ? MAINNET : TESTNET;
  } catch {
    current = TESTNET;
  }
  return current;
}

export function setActiveNetwork(key: NetworkKey): void {
  current = NETWORKS[key];
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // The choice holds for this page.
  }
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The network, re-rendering on a switch; Practice in the static HTML (the client takes over at hydration). */
export function useNetwork(): NetworkConfig {
  return useSyncExternalStore(subscribe, activeNetwork, () => TESTNET);
}
