/**
 * The query layer's clients for the app (`@senryo/query`): the selected network and our API client (the app makes no
 * RPC calls, D-280). Mounted once under the QueryClientProvider and the
 * AccountProvider, so every hook (profiles, notifications, the wallet balance, sends) finds its env.
 */
import { QueryEnvProvider } from "@senryo/query";
import type { ReactNode } from "react";
import { api } from "~/lib/account/api";
import { useNetwork } from "~/lib/network";

export function QueryEnvHost({ children }: { children: ReactNode }) {
  // A network switch re-points every query: keys carry the chain.
  const network = useNetwork();
  return (
    <QueryEnvProvider chainId={network.chainId} api={api()}>
      {children}
    </QueryEnvProvider>
  );
}
