"use client";
/**
 * A shared call (`/call?id=<ticketId>&chainId=<chain>`, the phone's share card link): its receipt for anyone, on the
 * network the link names — no account, no stream; only the api's history (D-280). A bad link says so.
 */
import { isChainId } from "@senryo/config";
import { QueryEnvProvider } from "@senryo/query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "@/lib/account/api";
import { QUERY_RETRIES, QUERY_STALE_MS } from "@/lib/constants/query";
import { CallReceipt } from "./CallReceipt";

const TICKET_ID = /^\d{1,78}$/;

function Receipt() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const chainId = Number(params.get("chainId"));
  if (!TICKET_ID.test(id) || !isChainId(chainId))
    return <p className="text-body text-text-2">This link doesn't name a call. Ask for the link again.</p>;
  return (
    <QueryEnvProvider chainId={chainId} api={api()}>
      <CallReceipt ticketId={BigInt(id)} chainId={chainId} publicView />
    </QueryEnvProvider>
  );
}

export function PublicCall() {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: QUERY_STALE_MS, retry: QUERY_RETRIES } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <Suspense fallback={<p className="text-body text-text-3">Loading the call…</p>}>
        <Receipt />
      </Suspense>
    </QueryClientProvider>
  );
}
