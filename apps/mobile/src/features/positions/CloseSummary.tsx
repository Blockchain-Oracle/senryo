import { ENGINE_MARKETS } from "@senryo/config";
import type { OperationRecord } from "@senryo/query";
import { StyleSheet, Text, View } from "react-native";
import { KeyValue, Panel } from "~/components/kit/Surface";
import { CircleCheck } from "~/components/kit/symbols";
import { pct, price18, priceDecimalsOf, signedUsd, usd } from "~/lib/money";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import type { ReduceQuote } from "./usePosition";

/**
 * What a finalized close did, above its trace (inventory: receipt — "exact event status, financial breakdown"): the
 * headline says what closed, and the figures are the quote at the hold, labelled as quoted — the filled values are on
 * Activity once indexed. Shown only after the transaction is finalized (D-114), never on a submit or a vote.
 */
export function CloseSummary({
  marketId,
  quote,
  record,
}: {
  marketId: number;
  quote: ReduceQuote;
  record?: OperationRecord | undefined;
}) {
  const { color } = useTheme();
  const symbol = ENGINE_MARKETS.find((m) => m.id === marketId)?.symbol ?? "";
  const side = quote.isLong ? "long" : "short";
  const actual = record?.steps
    .flatMap((s) => s.facts ?? [])
    .find((f) => f.event === "PositionUpdated" && f.values.marketId === String(marketId))?.values;
  const realised = actual ? BigInt(actual.realizedPnl ?? "0") : quote.realizedPnlUsd6;
  const fee = actual ? BigInt(actual.fee ?? "0") : quote.feeUsd6;
  const net = actual ? realised - fee - BigInt(actual.funding ?? "0") - BigInt(actual.borrow ?? "0") : quote.netUsd6;
  const gain = net >= 0n;
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <CircleCheck size={SIZE.avatarSm} strokeWidth={SIZE.iconStroke} color={color.up} />
        <Text accessibilityRole="header" style={[TYPE.sheetHeading, styles.center, { color: color.ink }]}>
          {quote.closingAll ? `${symbol} ${side} closed` : `${symbol} ${side} reduced by ${pct(quote.shareBps)}`}
        </Text>
        <Text style={[TYPE.displayPrice, { color: gain ? color.up : color.down }]}>{signedUsd(net)}</Text>
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
          {actual ? "Trading balance change · finalized" : "Trading balance change (estimated)"}
        </Text>
      </View>
      <Panel style={styles.rows}>
        <KeyValue
          label={actual ? "Exit price" : "Exit price (estimated)"}
          value={price18(actual ? BigInt(actual.execPrice ?? "0") : quote.execPrice18, priceDecimalsOf(marketId))}
        />
        <KeyValue label={actual ? "Realized" : "Realized (estimated)"} value={signedUsd(realised)} />
        <KeyValue label={actual ? "Fee" : "Fee (estimated)"} value={usd(fee)} />
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.lg },
  head: { alignItems: "center", gap: SPACE.xs, paddingTop: SPACE.md },
  center: { textAlign: "center" },
  rows: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm },
});
