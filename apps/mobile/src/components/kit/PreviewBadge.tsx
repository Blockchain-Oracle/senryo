import { StyleSheet, Text, View } from "react-native";
import { SAMPLE_NOTE } from "~/lib/sample";
import { HAIRLINE_PX, RADIUS, SPACE, TYPE, useTheme } from "~/theme";

/**
 * Marks every surface that renders `src/lib/sample.ts`: nothing on it is the user's money or a live market.
 * Removed screen by screen as S6–S8 wire real reads.
 */
export function PreviewBadge() {
  const { color } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`Preview data. ${SAMPLE_NOTE}`}
      style={[styles.badge, { borderColor: color.warn, backgroundColor: color.warnWash }]}
    >
      <Text style={[TYPE.label, { color: color.warn }]}>PREVIEW DATA</Text>
      <Text style={[TYPE.caption, styles.note, { color: color.inkMuted }]} numberOfLines={2}>
        {SAMPLE_NOTE}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderWidth: HAIRLINE_PX,
    borderRadius: RADIUS.sm,
  },
  note: { flex: 1 },
});
