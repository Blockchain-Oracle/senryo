import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Panel } from "~/components/kit/Surface";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { SlideToConfirm } from "~/components/trade/SlideToConfirm";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SPACE, TYPE, useTheme } from "~/theme";

/**
 * The risk explainer (F10 step 2, D-023; flow book C3 step 6, C3a): three facts before the first leveraged trade, and
 * a fourth before the first short — each a borderless filled card on the sheet, accepted with one slide. The general
 * three are shown once; the short card once more for the first short (`?side=short`). After accepting, the user
 * slides the order again (nothing is sent from here).
 */
const CARDS = [
  {
    title: "Leverage multiplies gains and losses",
    body: "At 5× a 1% move is 5% of your margin, both ways. Settled in dollars: nothing is delivered.",
  },
  {
    title: "Liquidation",
    body: "If losses reach the maintenance level, the position closes with a 1% fee. The ticket shows the price.",
  },
  {
    title: "Market hours",
    body: "When a market is closed or its price pauses, closing still works; opening waits for the market.",
  },
] as const;

const SHORT_CARD = {
  title: "Short: you profit if the price falls",
  body: "Losses grow if it rises, and liquidation sits above your entry. Shorts receive funding when longs dominate.",
} as const;

export default function RiskExplainerSheet() {
  return (
    <Sheet onClose={() => router.back()} closeLabel="Close the risk explainer">
      <Body />
    </Sheet>
  );
}

function Body() {
  const { color } = useTheme();
  const close = useSheetClose();
  const { side } = useLocalSearchParams<{ side?: string }>();
  // From the ticket the side is named and only what wasn't accepted yet is shown; from the Perps card, all four.
  const fromTicket = side === "long" || side === "short";
  const general = !fromTicket || !(storage.getBoolean(STORAGE_KEYS.riskExplained) ?? false);
  const short = !fromTicket || side === "short";
  const cards = [...(general ? CARDS : []), ...(short ? [SHORT_CARD] : [])];
  return (
    <View style={styles.body}>
      <Text accessibilityRole="header" style={[TYPE.sheetHeading, styles.center, { color: color.ink }]}>
        {general ? "Before your first trade" : "Before your first short"}
      </Text>
      {cards.map((c, i) => (
        <Panel key={c.title} style={styles.card}>
          <Text style={[TYPE.meta, { color: color.text3 }]}>
            {i + 1} / {cards.length}
          </Text>
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>{c.title}</Text>
          <Text style={[TYPE.rowDetail, { color: color.text2 }]}>{c.body}</Text>
        </Panel>
      ))}
      <SlideToConfirm
        label="Slide to accept"
        tone={fromTicket && short ? "down" : "primary"}
        onConfirm={() => {
          storage.set(STORAGE_KEYS.riskExplained, true);
          if (short) storage.set(STORAGE_KEYS.shortRiskExplained, true);
          close();
        }}
      />
      <Button label="Not now" variant="ghost" onPress={() => close()} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: SPACE.md },
  center: { textAlign: "center" },
  card: { padding: SPACE.lg, gap: SPACE.xs },
});
