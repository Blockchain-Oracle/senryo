import type { ReactNode } from "react";
import { type StyleProp, StyleSheet, Text, type TextStyle, View, type ViewStyle } from "react-native";
import { HAIRLINE_PX, RADIUS, SPACE, TYPE, useTheme } from "~/theme";

/** A D2 panel: card ground, 1 px hairline, 4 px corners, no shadow. */
export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { color } = useTheme();
  return (
    <View style={[styles.panel, { backgroundColor: color.card, borderColor: color.hairline }, style]}>{children}</View>
  );
}

/** The tracked uppercase section label ("POSITIONS · 2", "EQUITY · RISK-ADJUSTED"). */
export function SectionLabel({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const { color } = useTheme();
  return (
    <Text accessibilityRole="header" style={[TYPE.label, { color: color.inkMuted }, style]}>
      {children}
    </Text>
  );
}

/** A label/value row (ticket summary, quote rows). */
export function KeyValue({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.kv} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={[TYPE.label, { color: color.inkMuted }]}>{label}</Text>
      <Text style={[TYPE.numSm, { color: valueColor ?? color.ink }]}>{value}</Text>
    </View>
  );
}

/** A hairline divider. */
export function Rule() {
  const { color } = useTheme();
  return <View style={[styles.rule, { backgroundColor: color.hairline }]} />;
}

const styles = StyleSheet.create({
  panel: { borderWidth: HAIRLINE_PX, borderRadius: RADIUS.sm, overflow: "hidden" },
  kv: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingVertical: SPACE.xs },
  rule: { height: HAIRLINE_PX, alignSelf: "stretch" },
});
