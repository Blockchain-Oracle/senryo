import { StyleSheet, Text, View } from "react-native";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { EntityMark } from "./EntityMark";

/**
 * One entity on a line: its real mark (or its owner's wordmark, drawn `size` tall at its own proportions), the text
 * that names it, and an optional value on the right (a balance, a route, a source). The text always carries the
 * identity; the mark never replaces it.
 */
export function MarkedLine({
  id,
  label,
  value,
  size = SIZE.markInline,
  variant = "disc",
}: {
  id: string;
  label: string;
  value?: string;
  size?: number;
  variant?: "disc" | "symbol" | "wordmark";
}) {
  const { color } = useTheme();
  return (
    <View style={styles.row} accessible accessibilityLabel={value ? `${label} ${value}` : label}>
      <EntityMark id={id} size={size} variant={variant} decorative />
      <Text style={[TYPE.bodyStrong, styles.label, { color: color.ink }]} numberOfLines={1}>
        {label}
      </Text>
      {value ? <Text style={[TYPE.numSm, { color: color.ink }]}>{value}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, paddingVertical: SPACE.xxs },
  label: { flex: 1 },
});
