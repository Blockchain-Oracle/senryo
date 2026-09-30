import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Sheet, useSheetClose } from "~/components/sheet/Sheet";
import { HoldToConfirm } from "~/components/trade/HoldToConfirm";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { HAIRLINE_PX, RADIUS, SPACE, TYPE, useTheme } from "~/theme";

/** F10 step 2 / D-023: three facts before the first leveraged trade, accepted with a hold. Shown once (MMKV flag). */
const CARDS = [
  {
    title: "Leverage multiplies gains and losses",
    body: "At 5× a 1% move in gold is 5% of your margin, both ways. Perps are cash-settled: you never own the metal.",
  },
  {
    title: "Liquidation",
    body: "If losses eat your margin down to the maintenance level, the position is closed with a 1% penalty. The ticket shows the price and how far away it is.",
  },
  {
    title: "Market hours",
    body: "Gold trades nearly 24/5. When the session is closed, or the price feed pauses, you can still close — opening waits for the market.",
  },
] as const;

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
  return (
    <View style={styles.body}>
      <Text accessibilityRole="header" style={[TYPE.title, { color: color.ink }]}>
        Before your first trade
      </Text>
      {CARDS.map((c, i) => (
        <View key={c.title} style={[styles.card, { borderColor: color.hairline, backgroundColor: color.ground }]}>
          <Text style={[TYPE.label, { color: color.inkMuted }]}>
            {i + 1} / {CARDS.length}
          </Text>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{c.title}</Text>
          <Text style={[TYPE.body, { color: color.inkMuted }]}>{c.body}</Text>
        </View>
      ))}
      <HoldToConfirm
        label="Hold · I understand"
        onConfirm={() => {
          storage.set(STORAGE_KEYS.riskExplained, true);
          close();
        }}
        accessibilityHint="Hold to accept; then hold the trade button again to place it"
      />
      <Button label="Not now" variant="ghost" onPress={() => close()} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: SPACE.md },
  card: { borderWidth: HAIRLINE_PX, borderRadius: RADIUS.sm, padding: SPACE.md, gap: SPACE.xs },
});
