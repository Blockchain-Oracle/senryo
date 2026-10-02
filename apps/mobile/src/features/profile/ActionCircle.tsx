/**
 * An action circle with its label under it (D-196 / Part A rule 6: 56 pt circles + label; Phantom/Solflare Receive's
 * Copy · Share): a filled disc one step lighter than the page with the glyph in full ink, the label in quiet ink.
 * Press 0.97 and a `tick`. A label can change in place ("Copied") without the row moving.
 */
import { Pressable, StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";
import type { SymbolIcon } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { CONTROL_FONT_SCALE, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const CIRCLE = 56;

export function ActionCircle({
  label,
  icon: Glyph,
  onPress,
}: {
  label: string;
  icon: SymbolIcon;
  onPress: () => void;
}) {
  const { color } = useTheme();
  const press = usePressScale();
  return (
    <Pressable
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onPress={() => {
        fire("tick");
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.wrap}
    >
      <Animated.View style={[styles.circle, { backgroundColor: color.card }, press.style]}>
        <Glyph size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.ink} />
      </Animated.View>
      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text2 }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: SPACE.sm, minWidth: CIRCLE + SPACE.lg },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center" },
});
