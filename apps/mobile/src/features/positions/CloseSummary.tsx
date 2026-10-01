import { ENGINE_MARKETS } from "@senryo/config";
import { CircleCheck } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { KeyValue, Panel } from "~/components/kit/Surface";
import { pct, price18, priceDecimalsOf, signedUsd, usd } from "~/lib/money";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import type { ReduceQuote } from "./usePosition";

/**
 * What a finalized close did, above its trace (inventory: receipt — "exact event status, financial breakdown"): the
 * headline says what closed, and the figures are the quote at the hold, labelled as quoted — the filled values are on
 * Activity once indexed. Shown only after the transaction is finalized (D-114), never on a submit or a vote.
 */
export function CloseSummary({ marketId, quote }: { marketId: number; quote: ReduceQuote }) {
  const { color } = useTheme();
  const symbol = ENGINE_MARKETS.find((m) => m.id === marketId)?.symbol ?? "";
  const side = quote.isLong ? "long" : "short";
  const gain = quote.netUsd6 >= 0n;
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <CircleCheck size={SIZE.avatarSm} strokeWidth={SIZE.iconStroke} color={color.up} />
        <Text accessibilityRole="header" style={[TYPE.sheetHeading, styles.center, { color: color.ink }]}>
          {quote.closingAll ? `${symbol} ${side} closed` : `${symbol} ${side} reduced by ${pct(quote.shareBps)}`}
        </Text>
        <Text style={[TYPE.displayPrice, { color: gain ? color.up : color.down }]}>{signedUsd(quote.netUsd6)}</Text>
        <Text style={[TYPE.rowDetail, { color: color.text3 }]}>to your balance · quoted at your hold</Text>
      </View>
      <Panel style={styles.rows}>
        <KeyValue label="Exit price (quoted)" value={price18(quote.execPrice18, priceDecimalsOf(marketId))} />
        <KeyValue label="Realised (quoted)" value={signedUsd(quote.realizedPnlUsd6)} />
        <KeyValue label="Fee (quoted)" value={usd(quote.feeUsd6)} />
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
