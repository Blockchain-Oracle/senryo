import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { cardAuthRoute } from "~/lib/constants/routes";
import { signedUsd } from "~/lib/money";
import type { CardAuth } from "~/lib/sample";
import { BUTTON, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const STATE_LABEL = { hold: "Hold", settled: "Settled", declined: "Declined" } as const;
const ROW_PRESS_SCALE = 0.985;

/**
 * One card authorization in the market-row anatomy (bare on the page): the merchant over its state in words (hold,
 * settled, declined — colour only repeats it), the amount at the right. A row opens its detail.
 */
export function AuthorizationRow({ auth }: { auth: CardAuth }) {
  const { color } = useTheme();
  const press = usePressScale(ROW_PRESS_SCALE);
  const tint = { hold: color.gold, settled: color.text3, declined: color.down }[auth.state];
  return (
    <Animated.View style={press.style}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("tick");
          router.push(cardAuthRoute(auth.id));
        }}
        accessibilityRole="button"
        accessibilityLabel={`${auth.merchant}, ${STATE_LABEL[auth.state]}, ${signedUsd(-auth.amount6)}`}
        style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.card } : null]}
      >
        <View style={styles.text}>
          <Text style={[TYPE.rowTitle, { color: color.ink }]} numberOfLines={1}>
            {auth.merchant}
          </Text>
          <Text style={[TYPE.rowDetail, { color: tint }]}>{STATE_LABEL[auth.state]}</Text>
        </View>
        <Text style={[TYPE.rowPrice, { color: color.ink }]}>{signedUsd(-auth.amount6)}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: SIZE.rowMinHeight,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.sm,
    marginHorizontal: -SPACE.sm,
    borderRadius: BUTTON.radius.md,
  },
  text: { flex: 1, gap: SPACE.xxs },
});
