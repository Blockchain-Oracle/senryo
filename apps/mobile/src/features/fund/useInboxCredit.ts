import { addressOf, receiptFacts } from "@senryo/chain";
import { ActivityDocument, activityVars } from "@senryo/indexer-client";
import {
  collateralTokenOf,
  keys,
  type OperationRecord,
  type OperationStep,
  operationKey,
  readOperation,
  useQueryEnv,
  writeOperation,
} from "@senryo/query";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

const POLL_MS = 4_000;
/** Durable public arrival context. Disappearance alone never proves that the trading account was credited. */
export function useInboxCredit(
  user: `0x${string}`,
  inbox: `0x${string}` | undefined,
  waiting: bigint | undefined,
  observedBlock: bigint | undefined,
) {
  const env = useQueryEnv();
  const client = useQueryClient();
  const key = operationKey(env.chainId, user, `inbox-credit:${inbox}`);
  const [arrival, setArrival] = useState(() => readOperation(key));
  const previous = useRef({ key, waiting });
  const live = useRef(false);
  const record = arrival?.key === key ? arrival : readOperation(key);
  const blockNumber = record?.reviewedIntent.observedBlock;
  useEffect(() => {
    if (!inbox || waiting === undefined || waiting <= 0n || observedBlock === undefined) {
      previous.current = { key, waiting };
      return;
    }
    if (
      previous.current.key !== key ||
      previous.current.waiting === 0n ||
      !record ||
      (record.outcome === "completed" && observedBlock > BigInt(record.steps.at(-1)?.blockNumber ?? "0"))
    ) {
      const now = Date.now();
      const next: OperationRecord = {
        version: 1,
        id: `${key}:${observedBlock}`,
        key,
        account: user.toLowerCase(),
        chainId: env.chainId,
        kind: "inboxDeposit",
        plannedActions: ["inboxDeposit"],
        outcome: "pending",
        reviewedIntent: {
          source: inbox,
          destination: "trading",
          observedBlock: observedBlock.toString(),
          amount: waiting.toString(),
        },
        steps: [{ action: "inboxDeposit", outcome: "pending" }],
        createdAt: now,
        updatedAt: now,
      };
      writeOperation(next);
      live.current = true;
      setArrival(next);
    }
    previous.current = { key, waiting };
  }, [waiting, key, record, inbox, user, env.chainId, observedBlock]);
  const proof = useQuery({
    queryKey: [...keys.inbox(env.chainId, user), "credit", inbox, blockNumber],
    enabled: Boolean(inbox && blockNumber && record?.outcome !== "completed"),
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const observed = await env.read.getBlock({ blockNumber: BigInt(blockNumber ?? "0") });
      const rows = await env.indexer.request(
        ActivityDocument,
        activityVars({ chainId: env.chainId, user }, { after: Number(observed.timestamp) - 1, kinds: ["DEPOSIT"] }),
      );
      const head = await env.read.getBlock({ blockTag: "finalized" });
      const steps: OperationStep[] = [];
      const seen = new Set<string>();
      let credited = 0n;
      for (const row of rows) {
        if (seen.has(row.txHash)) continue;
        seen.add(row.txHash);
        const receipt = await env.read
          .getTransactionReceipt({ hash: row.txHash as `0x${string}` })
          .catch(() => undefined);
        if (
          receipt?.status !== "success" ||
          receipt.blockNumber > head.number ||
          receipt.blockNumber <= observed.number
        )
          continue;
        const canonical = await env.read.getBlock({ blockNumber: receipt.blockNumber });
        if (canonical.hash !== receipt.blockHash) continue;
        const facts = receiptFacts(receipt, env.chainId, addressOf(env.chainId, "SenryoCore"));
        const matching = facts.filter(
          (event) =>
            event.event === "Deposited" &&
            event.values.user?.toLowerCase() === user.toLowerCase() &&
            event.values.payer?.toLowerCase() === inbox?.toLowerCase() &&
            [collateralTokenOf(env.chainId, "AUSD"), collateralTokenOf(env.chainId, "USDC")].some(
              (token) => token.toLowerCase() === event.values.token?.toLowerCase(),
            ),
        );
        if (matching.length) {
          credited += matching.reduce((sum, event) => sum + BigInt(event.values.amount ?? "0"), 0n);
          steps.push({
            action: "inboxDeposit",
            outcome: "completed",
            hash: receipt.transactionHash,
            blockNumber: receipt.blockNumber.toString(),
            blockHash: receipt.blockHash,
            facts: matching,
          });
        }
      }
      if (credited >= BigInt(record?.reviewedIntent.amount ?? "0") && steps.length > 0) return steps;
      return null;
    },
  });
  useEffect(() => {
    if (!proof.data || !record || record.outcome === "completed") return;
    const next: OperationRecord = {
      ...record,
      outcome: "completed",
      updatedAt: Date.now(),
      steps: proof.data,
    };
    writeOperation(next, live.current);
    setArrival(next);
    void client.invalidateQueries({ queryKey: keys.account(env.chainId, user) });
  }, [proof.data, record, client, env.chainId, user]);
  return waiting === 0n && record?.outcome === "completed";
}
