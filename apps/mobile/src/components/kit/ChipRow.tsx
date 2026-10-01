import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";
import { fire } from "~/feedback/fire";
import { BUTTON, CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { usePressScale } from "./usePressScale";

/** Hit area beyond the 34 pt chip so the target reaches 44 pt. */
const CHIP_SLOP = (SIZE.touch - SIZE.chipRowHeight) / 2;

/**
 * Horizontal category chips (C14/C16, Fomo F09/F12; Codex consult 1 Oct): 34 pt rounded rectangles in one scrolling
 * row — the selected chip is a filled plate with full ink, the rest are bare labels in quiet ink. No outlines (Fomo
 * outlines its chips; we deliberately don't). A `tick` per change. Selection is a tab role for VoiceOver.
 */
export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  label,
  leading,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  label: string;
  /** A control that leads the row and scrolls with it (Fomo F09's filter button before the chips). */
  leading?: ReactNode;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel={label}
      contentContainerStyle={styles.row}
    >
      {leading}
      {options.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          selected={o.value === value}
          onPress={() => {
            if (o.value === value) return;
            fire("tick");
            onChange(o.value);
          }}
        />
      ))}
    </ScrollView>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { color } = useTheme();
  const press = usePressScale();
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        hitSlop={{ top: CHIP_SLOP, bottom: CHIP_SLOP }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={onPress}
        style={[styles.chip, { backgroundColor: selected ? color.raised2 : color.transparent }]}
      >
        <Text
          maxFontSizeMultiplier={CONTROL_FONT_SCALE}
          style={[TYPE.chipCategory, { color: selected ? color.ink : color.text3 }]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { gap: SPACE.sm, paddingHorizontal: SIZE.gutter, alignItems: "center" },
  chip: {
    height: SIZE.chipRowHeight,
    paddingHorizontal: SPACE.md,
    borderRadius: BUTTON.radius.sm,
    justifyContent: "center",
  },
});
