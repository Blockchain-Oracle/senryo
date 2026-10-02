import type { Address } from "@senryo/account";
import type { RelayResponse } from "@senryo/api-client";
import { addressOf, receiptFacts } from "@senryo/chain";
import { type OperationRecord, operationKey, type QueryEnv, readOperation, writeOperation } from "@senryo/query";

const livePreparations = new Set<string>();
export function restoredRelay(key: string) {
  const record = readOperation(key);
  if (record?.outcome === "preparing" && !livePreparations.has(record.id)) {
    relayNotSent(record);
    return readOperation(key);
  }
  return record;
}

export function relayOperation(env: QueryEnv, user: Address, kind: "claim" | "voucher"): OperationRecord {
  const key = operationKey(env.chainId, user, `relay-${kind}`);
  const previous = readOperation(key);
  if (previous && (previous.outcome === "pending" || previous.outcome === "preparing"))
    throw new Error("A relay request is still pending. Check its status before trying again.");
  const now = Date.now();
  const action = `${kind}Deposit`;
  const record: OperationRecord = {
    version: 1,
    id: `${key}:${now}`,
    key,
    account: user.toLowerCase(),
    chainId: env.chainId,
    kind,
    plannedActions: [action],
    outcome: "preparing",
    reviewedIntent: { source: "sponsor", destination: "trading", kind },
    steps: [{ action, outcome: "preparing" }],
    createdAt: now,
    updatedAt: now,
  };
  livePreparations.add(record.id);
  writeOperation(record);
  return record;
}
/** Record hand-off before calling the relay. A lost response must not permit a duplicate signed request. */
export function relaySubmitted(record: OperationRecord) {
  const next: OperationRecord = {
    ...record,
    outcome: "pending",
    steps: record.steps.map((step) => ({ ...step, outcome: "pending" })),
    updatedAt: Date.now(),
  };
  livePreparations.delete(record.id);
  writeOperation(next);
  return next;
}
export function relayNotSent(record: OperationRecord) {
  livePreparations.delete(record.id);
  writeOperation({
    ...record,
    outcome: "not-sent",
    steps: record.steps.map((step) => ({ ...step, outcome: "not-sent" })),
    updatedAt: Date.now(),
  });
}
/** Relay labels alone cannot produce a credit receipt or outcome sound: verify its finalized canonical transaction. */
export async function relayProgress(env: QueryEnv, record: OperationRecord, relay: RelayResponse, live: boolean) {
  if (relay.chainId !== record.chainId || relay.user.toLowerCase() !== record.account || relay.kind !== record.kind)
    throw new Error("Relay scope does not match this operation");
  let next: OperationRecord = {
    ...record,
    outcome: "pending",
    updatedAt: Date.now(),
    steps: [
      {
        action: record.steps[0]?.action ?? `${relay.kind}Deposit`,
        outcome: "pending",
        hash: relay.txHash,
        request: { relayId: relay.relayId },
      },
    ],
  };
  if (relay.stage === "finalized" || relay.stage === "reverted") {
    const receipt = await env.read.getTransactionReceipt({ hash: relay.txHash });
    const head = await env.read.getBlock({ blockTag: "finalized" });
    const canonical = await env.read.getBlock({ blockNumber: receipt.blockNumber });
    if (
      receipt.blockNumber <= head.number &&
      receipt.blockHash === canonical.hash &&
      receipt.to?.toLowerCase() === addressOf(env.chainId, "StarterDrip").toLowerCase()
    ) {
      const facts = receiptFacts(receipt, env.chainId, addressOf(env.chainId, "SenryoCore"));
      const credited = facts
        .filter(
          (fact) =>
            fact.event === "Deposited" &&
            fact.values.user?.toLowerCase() === record.account &&
            fact.values.payer?.toLowerCase() === addressOf(env.chainId, "StarterDrip").toLowerCase(),
        )
        .reduce((sum, fact) => sum + BigInt(fact.values.amount ?? "0"), 0n);
      const outcome =
        receipt.status === "reverted"
          ? "reverted"
          : relay.creditUsd6 === 0n || credited >= relay.creditUsd6
            ? "completed"
            : "pending";
      next = {
        ...next,
        outcome,
        steps: [
          {
            ...next.steps[0],
            action: next.steps[0]?.action ?? record.kind,
            outcome,
            blockNumber: receipt.blockNumber.toString(),
            blockHash: receipt.blockHash,
            facts,
          },
        ],
      };
    }
  }
  writeOperation(next, live);
  return next;
}
