/**
 * Cancel one TP/SL level by its id (flow book C6 step 3 "cancel", C8 Orders), in session — `cancelTrigger` is
 * reduce-class, never capped. One trace per account and network, reused one cancel at a time: a cancel whose result
 * isn't known yet blocks the next (the trace refuses), so nothing is sent twice. Levels whose cancel finalized leave
 * the list at once, before the indexer catches up.
 */
import { cancelTriggerRequest, useQueryEnv, useSendTrace } from "@senryo/query";
import { useState } from "react";
import { useSettledOutcome } from "~/features/trade/send-outcome";
import { useEnsureGas } from "~/features/trade/useGasTopUp";
import { useAccount } from "~/lib/account/provider";
import { userSender } from "~/lib/account/sender";

export function useCancelOrder() {
  const env = useQueryEnv();
  const account = useAccount();
  const address = account.hint?.address;
  const gas = useEnsureGas();
  const trace = useSendTrace(`orders:${env.chainId}:${address ?? "guest"}:cancel`);
  const outcome = useSettledOutcome(trace.events);
  const [cancelled, setCancelled] = useState<ReadonlySet<string>>(() => new Set());
  const [pending, setPending] = useState<string | undefined>();

  const cancel = async (orderId: string) => {
    const client = account.client;
    if (!client || !address || trace.running || outcome === "unknown") return;
    setPending(orderId);
    const request = cancelTriggerRequest(env.chainId, orderId as `0x${string}`);
    const result = await trace.run(userSender(client, address, account.settings.faceId), request, {
      preflight: gas.preflight(request),
      reviewedIntent: { orderId },
    });
    if (result?.final?.stage === "finalized") setCancelled((prev) => new Set(prev).add(orderId));
    setPending(undefined);
  };

  return {
    cancel,
    cancelled,
    /** The level a cancel is running for. */
    pending: trace.running ? pending : undefined,
    /** A signed cancel whose result isn't known yet: no new cancel until it settles. */
    unresolved: outcome === "unknown",
    failed: outcome === "reverted" || outcome === "abandoned" || outcome === "not-sent",
    ready: account.client !== undefined,
  };
}
