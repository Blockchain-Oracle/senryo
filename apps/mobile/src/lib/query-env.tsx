/**
 * The query layer's clients for the app (`@senryo/query`): the selected network, the shared viem read client (until
 * S5 serves balances over the stream, D-272) and our API client. Mounted once under the QueryClientProvider and the
 * AccountProvider, so every hook (profiles, notifications, the wallet balance, sends) finds its env.
 *
 * It also wires the two send-safety hooks: the operation journal persists in MMKV (TxRecovery resumes it after a
 * kill), and a reviewed operation refuses to sign once the account, network or app state changed under it.
 */
import { configureOperationScopeValidator, configureOperationStorage, QueryEnvProvider } from "@senryo/query";
import type { ReactNode } from "react";
import { AppState } from "react-native";
import { api } from "~/lib/account/api";
import { useAccount } from "~/lib/account/provider";
import { sharedRead } from "~/lib/account/sender";
import { activeNetwork, useNetwork } from "~/lib/network";
import { storage } from "~/lib/storage";

configureOperationStorage({
  get: (key) => storage.getString(key),
  set: (key, value) => storage.set(key, value),
  keys: () => storage.getAllKeys(),
});

export function QueryEnvHost({ children }: { children: ReactNode }) {
  // A network switch re-points every query: keys carry the chain.
  const network = useNetwork();
  const account = useAccount();
  configureOperationScopeValidator((chainId, address) => {
    if (
      activeNetwork().chainId !== chainId ||
      account.hint?.address.toLowerCase() !== address.toLowerCase() ||
      AppState.currentState !== "active"
    )
      throw new Error("The account, network or app state changed. Review again.");
  });
  return (
    <QueryEnvProvider chainId={network.chainId} read={sharedRead(network.chainId)} api={api()}>
      {children}
    </QueryEnvProvider>
  );
}
