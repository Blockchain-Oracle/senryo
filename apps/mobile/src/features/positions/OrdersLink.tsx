import { router } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";
import { ChevronRight } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/** "Orders ›" — Activity's way to the TP/SL list (flow book C8 entry point). */
export function OrdersLink() {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        router.push(ROUTES.orders);
      }}
      accessibilityRole="link"
      accessibilityLabel="Orders: your take profit and stop loss levels"
      style={({ pressed }) => [styles.row, { opacity: pressed ? PRESSED : 1 }]}
    >
      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowTitle, styles.flex, { color: color.ink }]}>
        Orders
      </Text>
      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text3 }]}>
        TP / SL
      </Text>
      <ChevronRight size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />
    </Pressable>
  );
}

const PRESSED = 0.6;

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, minHeight: SIZE.touch },
  flex: { flex: 1 },
});
