import { explorerTxUrl } from "@senryo/config";
import { operationsFor, subscribeOperations } from "@senryo/query";
import { useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { OperationSummary } from "~/components/trade/OperationSummary";
import { useAccount } from "~/lib/account/provider";
import { useNetwork } from "~/lib/network";
import { SPACE, TYPE, useTheme } from "~/theme";

const RECENT_LIMIT = 8;
/** Account/network scoped public records keep unfinished multi-transaction journeys visible after relaunch. */
export function PendingOperations() {
  const address = useAccount().hint?.address;
  const network = useNetwork();
  const { color } = useTheme();
  const [, refresh] = useState(0);
  useEffect(() => subscribeOperations(() => refresh((revision) => revision + 1)), []);
  const records = address
    ? operationsFor(network.chainId, address)
        .filter(
          (record) => record.outcome === "pending" || record.outcome === "preparing" || record.outcome === "partial",
        )
        .slice(0, RECENT_LIMIT)
    : [];
  if (!records.length) return null;
  return (
    <View style={{ gap: SPACE.lg }}>
      <Text accessibilityRole="header" style={[TYPE.rowTitle, { color: color.ink }]}>
        Pending on this device
      </Text>
      {records.map((record) => (
        <View key={record.id} style={{ gap: SPACE.sm }}>
          <Text style={[TYPE.meta, { color: color.text3 }]}>
            {record.reviewedIntent.symbol ?? ""} {record.reviewedIntent.source ?? ""} →{" "}
            {record.reviewedIntent.destination ?? record.reviewedIntent.recipient ?? "Account"}
          </Text>
          <OperationSummary record={record} />
          {record.steps
            .filter((step) => step.hash)
            .map((step) => (
              <Button
                key={step.hash}
                label="Transaction details"
                size="sm"
                variant="ghost"
                onPress={() => void Linking.openURL(explorerTxUrl(network.chainId, step.hash ?? ""))}
              />
            ))}
          <Text style={[TYPE.meta, { color: color.text3 }]}>
            Check the original action to review its result. Recovery never sends it again.
          </Text>
        </View>
      ))}
    </View>
  );
}
