import { addressOf, isDeployed, readPerplAccount, receiptFacts } from "@senryo/chain";
import { PERPL_EXCHANGE } from "@senryo/config";
import { ActivityDocument, activityVars } from "@senryo/indexer-client";
import { type ConfirmedFeedback, confirmedFeedback, keys, perplReadOf, useQueryEnv } from "@senryo/query";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useAccount } from "~/lib/account/provider";

const SECOND_MS = 1000;
const FRESH_SEC = 30;
const POLL_MS = 5000;
const MAX_EVENTS = 20;
/** Finalized activity wakes feedback for keeper closes, with the same receipt identity as the operation host.
 * Cold start/foreground establishes a new source-time boundary; no historical/backlog playback.
 */
export function useIndexedTradeFeedback(consume: (event: ConfirmedFeedback) => void): void {
  const env = useQueryEnv();
  const address = useAccount().hint?.address;
  const [active, setActive] = useState(AppState.currentState === "active");
  const scope = `${env.chainId}:${address ?? ""}`;
  const boundary = useRef({ scope, since: Math.floor(Date.now() / SECOND_MS) });
  if (boundary.current.scope !== scope) boundary.current = { scope, since: Math.floor(Date.now() / SECOND_MS) };
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") boundary.current = { scope, since: Math.floor(Date.now() / SECOND_MS) };
      setActive(state === "active");
    });
    return () => listener.remove();
  }, [scope]);
  const since = boundary.current.since;
  const events = useQuery({
    queryKey: [...keys.account(env.chainId, address ?? "0x"), "confirmed-feedback", since],
    enabled: active && address !== undefined,
    refetchInterval: POLL_MS,
    queryFn: async () => {
      if (!address) return [];
      const rows = await env.indexer.request(
        ActivityDocument,
        activityVars({ chainId: env.chainId, user: address }, { after: since, limit: MAX_EVENTS }),
      );
      const now = Math.floor(Date.now() / SECOND_MS);
      const fills = rows.filter(
        (row) => row.fill && row.fill.size > 0n && row.timestamp <= now && now - row.timestamp <= FRESH_SEC,
      );
      if (!fills.length) return [];
      const finalized = await env.read.getBlock({ blockTag: "finalized" });
      const output: ConfirmedFeedback[] = [];
      for (const row of fills) {
        if (BigInt(row.block) > finalized.number) continue;
        const receipt = await env.read.getTransactionReceipt({ hash: row.txHash as `0x${string}` });
        if (receipt.status !== "success" || receipt.blockNumber !== BigInt(row.block)) continue;
        let facts = isDeployed(env.chainId, "SenryoCore")
          ? receiptFacts(receipt, env.chainId, addressOf(env.chainId, "SenryoCore"))
          : [];
        facts = facts.filter(
          (fact) => fact.event === "PositionUpdated" && fact.values.user?.toLowerCase() === address.toLowerCase(),
        );
        let action = "close";
        if (!facts.length) {
          facts = receiptFacts(receipt, env.chainId, PERPL_EXCHANGE[env.chainId]);
          const taker = facts.find((fact) => fact.event === "OrderRequestV2")?.values.accountId;
          const account = await readPerplAccount(perplReadOf(env), env.chainId, address);
          if (!account || taker !== account.accountId.toString()) continue;
          action = "perplOrder";
        }
        output.push(
          ...confirmedFeedback({
            version: 1,
            id: row.id,
            key: row.id,
            account: address,
            chainId: env.chainId,
            kind: "indexed-fill",
            plannedActions: [action],
            reviewedIntent: {},
            outcome: "completed",
            steps: [{ action, hash: row.txHash, outcome: "completed", facts }],
            createdAt: row.timestamp * SECOND_MS,
            updatedAt: Date.now(),
          }),
        );
      }
      return output;
    },
  });
  useEffect(() => {
    if (active && AppState.currentState === "active") for (const event of events.data ?? []) consume(event);
  }, [active, consume, events.data]);
}
