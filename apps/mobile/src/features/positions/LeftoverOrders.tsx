/**
 * Leftover TP/SL on a market with no open position (flow book C6 gap "orphan triggers can't be cancelled"): each level
 * as a row with Remove. The keeper already skips them (C6 rule a); removing them keeps Orders honest.
 */
import { useTriggers } from "@senryo/query";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { useAccount } from "~/lib/account/provider";
import { price18, priceDecimalsOf } from "~/lib/money";
import { CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { useCancelOrder } from "./useCancelOrder";

export function LeftoverOrders({ marketId }: { marketId: number }) {
  const { color } = useTheme();
  const triggers = useTriggers(useAccount().hint?.address);
  const orders = useCancelOrder();
  const decimals = priceDecimalsOf(marketId);
  const left =
    triggers.status === "fresh" || triggers.status === "stale"
      ? triggers.value.filter((t) => t.market_id === `ours-${marketId}` && !orders.cancelled.has(t.id))
      : [];
  if (left.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <Text accessibilityRole="header" style={[TYPE.rowTitle, { color: color.ink }]}>
        Leftover TP/SL
      </Text>
      {left.map((t) => (
        <View key={t.id} style={styles.row}>
          <Text
            maxFontSizeMultiplier={CONTROL_FONT_SCALE}
            style={[TYPE.rowAmount, styles.flex, { color: t.takeProfit ? color.up : color.down }]}
          >
            {t.takeProfit ? "Take profit" : "Stop loss"} · ${price18(t.triggerPrice, decimals)}
          </Text>
          <Button
            label={orders.pending === t.id ? "Removing…" : "Remove"}
            size="sm"
            variant="outline"
            block={false}
            loading={orders.pending === t.id}
            disabled={orders.pending !== undefined || orders.unresolved || !orders.ready}
            onPress={() => void orders.cancel(t.id)}
          />
        </View>
      ))}
      {orders.failed ? (
        <Text style={[TYPE.meta, { color: color.down }]}>Not removed · still active</Text>
      ) : orders.unresolved ? (
        <Text style={[TYPE.meta, { color: color.warn }]}>Checking…</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.sm },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, minHeight: SIZE.touch },
  flex: { flex: 1 },
});
