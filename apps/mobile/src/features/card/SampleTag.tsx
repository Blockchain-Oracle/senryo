import { StyleSheet, Text } from "react-native";
import { RADIUS, SPACE, TYPE, useTheme } from "~/theme";

/** "Sample" beside a section that shows preview data (no card service yet): quieter than a banner, never omitted. */
export function SampleTag() {
  const { color } = useTheme();
  return (
    <Text
      accessibilityLabel="Sample data"
      style={[TYPE.chipLabel, styles.tag, { color: color.warn, backgroundColor: color.warnWash }]}
    >
      Sample
    </Text>
  );
}

const styles = StyleSheet.create({
  tag: {
    paddingHorizontal: SPACE.xs + SPACE.xxs,
    paddingVertical: SPACE.xxs,
    borderRadius: RADIUS.xs,
    overflow: "hidden",
  },
});
