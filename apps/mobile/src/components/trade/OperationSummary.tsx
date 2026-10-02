import type { OperationRecord } from "@senryo/query";
import { Text, View } from "react-native";
import { SPACE, TYPE, useTheme } from "~/theme";

const NAMES: Record<string, string> = {
  approve: "Approval",
  lpDeposit: "Pool deposit",
  deposit: "Trading deposit",
  spotSwap: "Swap",
  swapToken: "Swap",
  increase: "Position opened",
  placeTrigger: "Protection",
  erc20Transfer: "Transfer",
  withdraw: "Withdrawal",
  decrease: "Position reduced",
  lpRequestRedeem: "Redemption requested",
  lpClaimRedeem: "Redemption claimed",
  inboxDeposit: "Trading deposit",
  faucet: "Practice funds",
  setSpendAllowance: "Card limit",
  revokeSpendAllowance: "Card frozen",
};
const STATES = {
  preparing: "Preparing",
  pending: "Pending",
  completed: "Completed",
  reverted: "Reverted",
  abandoned: "Not included",
  "not-sent": "Not sent",
};
/** Each earlier completed step stays visible when a later action does not complete. */
export function OperationSummary({ record }: { record: OperationRecord | undefined }) {
  const { color } = useTheme();
  if (!record?.steps.length) return null;
  const remaining = [...record.plannedActions];
  for (const step of record.steps) {
    const index = remaining.indexOf(step.action);
    if (index >= 0) remaining.splice(index, 1);
  }
  const partial = record.outcome === "partial";
  return (
    <View style={{ gap: SPACE.sm }}>
      {partial ? <Text style={[TYPE.bodyStrong, { color: color.warn }]}>Partially completed</Text> : null}
      {record.steps.map((step, i) => (
        <View
          key={`${i}:${step.hash ?? step.action}`}
          style={{ flexDirection: "row", justifyContent: "space-between", gap: SPACE.md }}
        >
          <Text style={[TYPE.rowDetail, { color: color.text2 }]}>{NAMES[step.action] ?? step.action}</Text>
          <Text style={[TYPE.rowDetail, { color: step.outcome === "completed" ? color.up : color.text3 }]}>
            {STATES[step.outcome]}
          </Text>
        </View>
      ))}
      {remaining.map((action, index) => (
        <View
          key={`${action}:${index}`}
          style={{ flexDirection: "row", justifyContent: "space-between", gap: SPACE.md }}
        >
          <Text style={[TYPE.rowDetail, { color: color.text2 }]}>{NAMES[action] ?? action}</Text>
          <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Not started</Text>
        </View>
      ))}
    </View>
  );
}
