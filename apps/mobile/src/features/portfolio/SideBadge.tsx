import { StyleSheet, Text } from "react-native";
import { RADIUS, SPACE, TYPE, useTheme } from "~/theme";

/**
 * A position's side as a small filled badge (Fomo F12's "20x" beside the ticker): "Long 2.4×" on the up wash,
 * "Short 3×" on the down wash. The word carries the meaning; the colour only repeats it. `leverage` is omitted when
 * it cannot be stated (see `effectiveLeverage`).
 */
export function SideBadge({ isLong, leverage }: { isLong: boolean; leverage?: string | undefined }) {
  const { color } = useTheme();
  const side = isLong ? "Long" : "Short";
  return (
    <Text
      style={[
        TYPE.label,
        styles.badge,
        { color: isLong ? color.up : color.down, backgroundColor: isLong ? color.upWash : color.downWash },
      ]}
      numberOfLines={1}
    >
      {leverage ? `${side} ${leverage}` : side}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: SPACE.xs + SPACE.xxs,
    paddingVertical: SPACE.xxs,
    borderRadius: RADIUS.xs,
    overflow: "hidden",
  },
});
