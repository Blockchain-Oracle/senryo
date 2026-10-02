import type { TxRequest } from "@senryo/chain";
import type { OperationRecord, OperationStep } from "./operations.ts";
import { operationOutcome } from "./operations.ts";

const ID_RADIX = 36;
const RANDOM_PREFIX_LENGTH = 2;
/** Start a new step before invoking a builder, so a builder failure never rewrites an earlier approval. */
export function beginOperation(
  key: string,
  account: string,
  chainId: number,
  action: string,
  intent: Record<string, string> | undefined,
  parent: OperationRecord | undefined,
  plannedActions?: readonly string[],
): OperationRecord {
  if (parent && (parent.account !== account.toLowerCase() || parent.chainId !== chainId)) {
    throw new Error("The reviewed account or network changed. Review this action again.");
  }
  if (
    parent &&
    intent &&
    Object.entries(intent).some(
      ([key, value]) => parent.reviewedIntent[key] !== undefined && parent.reviewedIntent[key] !== value,
    )
  ) {
    throw new Error("The reviewed intent changed. Review this action again.");
  }
  const now = Date.now();
  return {
    version: 1,
    id: parent?.id ?? `${now.toString(ID_RADIX)}-${Math.random().toString(ID_RADIX).slice(RANDOM_PREFIX_LENGTH)}`,
    key,
    account: account.toLowerCase(),
    chainId,
    kind: parent?.kind ?? action,
    plannedActions: parent?.plannedActions ?? [...(plannedActions ?? [action])],
    outcome: parent ? "pending" : "preparing",
    reviewedIntent: parent?.reviewedIntent ?? { ...intent },
    steps: [...(parent?.steps ?? []), { action, outcome: "preparing", request: { ...intent } }],
    createdAt: parent?.createdAt ?? now,
    updatedAt: now,
  };
}
export function builtOperation(record: OperationRecord, request: TxRequest): OperationRecord {
  if (
    request.meta &&
    ["amount", "symbol", "recipient", "source", "marketId"].some(
      (key) =>
        request.meta?.[key] !== undefined &&
        record.reviewedIntent[key] !== undefined &&
        request.meta[key] !== record.reviewedIntent[key],
    )
  ) {
    throw new Error("The transaction differs from the reviewed intent.");
  }
  return {
    ...record,
    plannedActions:
      record.plannedActions.length === 1 && record.plannedActions[0] === "trigger"
        ? [request.action]
        : record.plannedActions,
    reviewedIntent: Object.keys(record.reviewedIntent).length > 0 ? record.reviewedIntent : { ...request.meta },
    steps: [
      ...record.steps.slice(0, -1),
      {
        action: request.action,
        outcome: "preparing",
        request: {
          target: request.to,
          calldata: request.data,
          valueWei: (request.value ?? 0n).toString(),
          ...request.meta,
        },
      },
    ],
  };
}
export function progressOperation(record: OperationRecord, stage: string, at: number, hash?: string): OperationRecord {
  const step = record.steps.at(-1);
  const outcome: OperationStep["outcome"] =
    stage === "finalized"
      ? "completed"
      : stage === "reverted" || stage === "abandoned"
        ? stage
        : stage === "failed" && !step?.hash
          ? "not-sent"
          : step?.hash || hash
            ? "pending"
            : "preparing";
  const steps: OperationStep[] = [
    ...record.steps.slice(0, -1),
    { ...step, action: step?.action ?? record.kind, outcome, ...(hash ? { hash } : {}) },
  ];
  return {
    ...record,
    outcome: operationOutcome(steps, record.plannedActions),
    updatedAt: at,
    steps,
  };
}
