import type { AccountSnapshot } from "@senryo/chain";
import { router } from "expo-router";
import { Info } from "lucide-react-native";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated from "react-native-reanimated";
import { useGroupFill } from "~/components/kit/Surface";
import { usePressScale } from "~/components/kit/usePressScale";
import { lockedOf } from "~/features/portfolio/account";
import { fire } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { usd } from "~/lib/money";
import { CONTROL_FONT_SCALE, RADIUS, SIZE, SPACE, STACK_FONT_SCALE, TYPE, useTheme } from "~/theme";

/** The row is as wide as the page, so it barely moves under the finger (the same reason as a sheet row). */
const ROW_PRESS_SCALE = 0.985;

/**
 * Home's availability (direction §7, D-178, C19): Free to trade, Free to spend and Locked as three plain capacities —
 * they overlap, so they are three separate cells and never an additive partition bar or a percentage legend. Each is
 * a borderless filled cell, one step lighter than the page, with a quiet label over its amount. The row is one
 * control: it opens Balance details, which explains each number in a line, says that they overlap and shows the
 * collateral behind them (the ⓘ in the last cell is the only hint the row needs; F09's banner carries the same mark).
 * At large text sizes the three cells stack, label and amount on one line, so neither label is cut short.
 */
export function Availability({ snapshot }: { snapshot: AccountSnapshot }) {
  const { color } = useTheme();
  const fill = useGroupFill();
  const press = usePressScale(ROW_PRESS_SCALE);
  const stacked = useWindowDimensions().fontScale > STACK_FONT_SCALE;
  const cells = [
    { key: "trade", label: "Free to trade", value: snapshot.freeToTrade },
    { key: "spend", label: "Free to spend", value: snapshot.freeToSpend },
    { key: "locked", label: "Locked", value: lockedOf(snapshot) },
  ] as const;
  return (
    <Animated.View style={press.style}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("tick");
          router.push(ROUTES.balanceDetails);
        }}
        accessibilityRole="button"
        accessibilityLabel={cells.map((c) => `${c.label} ${usd(c.value)}`).join(", ")}
        accessibilityHint="Opens balance details"
        style={stacked ? styles.column : styles.row}
      >
        {({ pressed }) =>
          cells.map((c, i) => (
            <View
              key={c.key}
              style={[
                styles.cell,
                stacked ? styles.line : null,
                { backgroundColor: pressed ? color.rowPressed : fill },
              ]}
            >
              <View style={[styles.label, stacked ? styles.grow : null]}>
                <Text
                  maxFontSizeMultiplier={CONTROL_FONT_SCALE}
                  style={[TYPE.meta, styles.grow, { color: color.text3 }]}
                  numberOfLines={1}
                >
                  {c.label}
                </Text>
                {i === cells.length - 1 ? (
                  <Info size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />
                ) : null}
              </View>
              <Text
                maxFontSizeMultiplier={CONTROL_FONT_SCALE}
                style={[TYPE.rowPrice, { color: c.value < 0n ? color.down : color.ink }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {usd(c.value)}
              </Text>
            </View>
          ))
        }
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: SPACE.sm },
  column: { gap: SPACE.xs },
  cell: { flex: 1, gap: SPACE.xs, paddingVertical: SPACE.md, paddingHorizontal: SPACE.md, borderRadius: RADIUS.md },
  line: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACE.md },
  label: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  grow: { flex: 1 },
});
