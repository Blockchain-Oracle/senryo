import { StyleSheet, Text } from "react-native";
import { CONTROL_FONT_SCALE, RADIUS, SPACE, TYPE, useTheme } from "~/theme";

/**
 * A position's side as a small filled badge (Fomo F12's badge beside the ticker): "Long" on the up wash, "Short" on
 * the down wash. The word carries the meaning; the colour only repeats it. No multiple: the engine is cross-margin,
 * so a position keeps no leverage of its own, and a figure derived from the balance would contradict the multiple
 * the ticket was sized with. Exposure is on the row.
 */
export function SideBadge({ isLong }: { isLong: boolean }) {
  const { color } = useTheme();
  const side = isLong ? "Long" : "Short";
  return (
    <Text
      maxFontSizeMultiplier={CONTROL_FONT_SCALE}
      style={[
        TYPE.label,
        styles.badge,
        { color: isLong ? color.up : color.down, backgroundColor: isLong ? color.upWash : color.downWash },
      ]}
      numberOfLines={1}
    >
      {side}
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
