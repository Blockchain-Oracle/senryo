/**
 * A section's name on You and the account pages (Fomo F16's "Positions"): 17 pt semibold ink on the page gutter,
 * above its group — a heading, not a tracked micro-label — with an optional quiet line under it.
 */
import { StyleSheet, Text, View } from "react-native";
import { SPACE, TYPE, useTheme } from "~/theme";

export function SectionHeading({ children, detail }: { children: string; detail?: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text accessibilityRole="header" style={[TYPE.rowTitle, { color: color.ink }]}>
        {children}
      </Text>
      {detail ? <Text style={[TYPE.rowDetail, { color: color.text3 }]}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { gap: SPACE.xs } });
