import type { AccountSnapshot } from "@senryo/chain";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useCardSummary } from "~/features/card/useCardSummary";
import { ROUTES } from "~/lib/constants/routes";
import { usd } from "~/lib/money";
import { SPACE, TYPE, useTheme } from "~/theme";

/** Spending capacity and trading capacity overlap; neither is added to the portfolio. */
export function Availability({ snapshot }: { snapshot: AccountSnapshot }) {
  const { color } = useTheme();
  const card = useCardSummary();
  const issued = card.data?.cards[0];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Trading and card availability. View details."
      onPress={() => router.push(ROUTES.balanceDetails)}
      style={styles.rows}
    >
      {[
        { label: "Available to trade", value: usd(snapshot.freeToTrade) },
        {
          label: "Card availability",
          value: issued
            ? issued.state === "PAUSED"
              ? "Frozen"
              : usd(snapshot.freeToSpend)
            : card.data
              ? "Not issued"
              : "Unavailable",
        },
      ].map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={[TYPE.rowDetail, { color: color.text3 }]}>{row.label}</Text>
          <Text style={[TYPE.rowAmount, { color: color.ink }]}>{row.value}</Text>
        </View>
      ))}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  rows: { gap: SPACE.sm, paddingVertical: SPACE.sm },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACE.md },
});
