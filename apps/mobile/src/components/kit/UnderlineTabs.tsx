import { type ComponentType, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { fire } from "~/feedback/fire";
import { CONTROL_FONT_SCALE, EASE, HAIRLINE_PX, SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";

/** The selected tab's underline (F09/F32 measure 2 pt). */
const UNDERLINE = 2;

/** A glyph beside a tab's label (Lucide icons fit): it takes the label's colour. */
export type TabIcon = ComponentType<{ size: number; color: string; strokeWidth: number }>;

/**
 * Text tabs with a sliding underline (Fomo F09 Watchlist / Tokens / Perps, F32 Holders / Feed / About): equal cells,
 * the selected label in full ink over a 2 pt primary line that travels to the selection in 170 ms, the rest in quiet
 * ink, and one hairline under the row that the line rides on. No plates and no outlines. A `tick` per change.
 * Typed like `Segmented`; selection is a tab role for VoiceOver.
 */
export function UnderlineTabs<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string; icon?: TabIcon }[];
  value: T;
  onChange: (next: T) => void;
  /** Group name for VoiceOver ("Market list"). */
  label: string;
}) {
  const { color } = useTheme();
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const cell = useSharedValue(0);
  const at = useSharedValue(index);
  useEffect(() => {
    at.value = withTiming(index, { duration: TIMING.selection, easing: EASE });
  }, [index, at]);
  const line = useAnimatedStyle(() => ({
    width: cell.value,
    transform: [{ translateX: at.value * cell.value }],
  }));
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      onLayout={(e) => {
        cell.value = e.nativeEvent.layout.width / options.length;
      }}
      style={styles.row}
    >
      {options.map((o) => {
        const selected = o.value === value;
        const ink = selected ? color.ink : color.text3;
        const Glyph = o.icon;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              fire("tick");
              onChange(o.value);
            }}
            style={styles.cell}
          >
            {Glyph ? <Glyph size={SIZE.iconSm + SPACE.xs} color={ink} strokeWidth={SIZE.iconStroke} /> : null}
            <Text
              maxFontSizeMultiplier={CONTROL_FONT_SCALE}
              style={[TYPE.buttonCompact, { color: ink }]}
              numberOfLines={1}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
      <View pointerEvents="none" style={[styles.rule, { backgroundColor: color.hairline }]} />
      <Animated.View pointerEvents="none" style={[styles.line, { backgroundColor: color.primary }, line]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", minHeight: SIZE.touch },
  cell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    paddingBottom: UNDERLINE,
  },
  rule: { position: "absolute", left: 0, right: 0, bottom: 0, height: HAIRLINE_PX },
  line: { position: "absolute", left: 0, bottom: 0, height: UNDERLINE },
});
