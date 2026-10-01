import { StyleSheet, Text, View } from "react-native";
import { SAMPLE_NOTE } from "~/lib/sample";
import { BUTTON, SPACE, TYPE, useTheme } from "~/theme";

/**
 * Marks every surface that renders `src/lib/sample.ts`: nothing on it is the user's money or a live market. A warning
 * wash with no border. Removed screen by screen as S6–S8 wire real reads.
 */
export function PreviewBadge() {
  const { color } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`Preview data. ${SAMPLE_NOTE}`}
      style={[styles.badge, { backgroundColor: color.warnWash }]}
    >
      <Text style={[TYPE.label, { color: color.warn }]}>Preview data</Text>
      <Text style={[TYPE.meta, styles.note, { color: color.text2 }]} numberOfLines={2}>
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
    padding: SPACE.md,
    borderRadius: BUTTON.radius.md,
  },
  note: { flex: 1 },
});
