import type { OperationRecord } from "./operations.ts";

export interface ConfirmedFeedback {
  key: string;
  semantic: "open" | "add" | "reduce" | "close" | "deposit" | "send";
}
/** Finalized decoded execution facts own trade feedback; outcome transitions do not create another fill. */
export function confirmedFeedback(record: OperationRecord): ConfirmedFeedback[] {
  return record.steps.flatMap((step) => {
    if (step.outcome !== "completed" || !step.hash) return [];
    let semantic: ConfirmedFeedback["semantic"] | undefined;
    if (step.action === "perplOrder") {
      if (
        !step.facts?.some(
          (f) =>
            f.event === "TakerOrderFilledV2" &&
            /^\d+$/.test(f.values.lotLNS ?? "") &&
            BigInt(f.values.lotLNS ?? "0") > 0n,
        )
      )
        return [];
      const events = new Set(step.facts.map((f) => f.event));
      semantic = events.has("PositionClosed")
        ? "close"
        : events.has("PositionDecreased")
          ? "reduce"
          : events.has("PositionIncreasedV2")
            ? "add"
            : events.has("PositionOpenedV2")
              ? "open"
              : undefined;
    } else if (["increase", "decrease", "close"].includes(step.action)) {
      const position = step.facts?.find((f) => f.event === "PositionUpdated");
      if (!position) return [];
      semantic =
        position.values.kind === "1"
          ? "add"
          : position.values.kind === "2"
            ? "reduce"
            : position.values.kind === "3" || (position.values.kind === "5" && position.values.sizeAfter === "0")
              ? "close"
              : position.values.kind === "0"
                ? "open"
                : undefined;
    } else if (/deposit|claim|faucet/i.test(step.action)) semantic = "deposit";
    else if (/withdraw|transfer|swap/i.test(step.action)) semantic = "send";
    if (!semantic) return [];
    return [{ key: `${record.chainId}:${record.account.toLowerCase()}:${step.hash.toLowerCase()}`, semantic }];
  });
}
