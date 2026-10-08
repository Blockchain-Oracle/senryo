import type { OperationRecord } from "./operations.ts";

/**
 * Sound and haptic for a finalized wallet send, once per hash. After the pivot (D-256) the only user-signed operations
 * are the wallet's own money moves; a call's open, fill, close and result arrive on the user's stream in S5 and own
 * their feedback there.
 */
export interface ConfirmedFeedback {
  key: string;
  semantic: "deposit" | "send";
}

export function confirmedFeedback(record: OperationRecord): ConfirmedFeedback[] {
  return record.steps.flatMap((step) => {
    if (step.outcome !== "completed" || !step.hash) return [];
    const semantic: ConfirmedFeedback["semantic"] | undefined = /deposit|claim|faucet/i.test(step.action)
      ? "deposit"
      : /withdraw|transfer/i.test(step.action)
        ? "send"
        : undefined;
    if (!semantic) return [];
    return [{ key: `${record.chainId}:${record.account.toLowerCase()}:${step.hash.toLowerCase()}`, semantic }];
  });
}
