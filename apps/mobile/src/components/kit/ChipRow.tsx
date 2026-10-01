import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { fire } from "~/feedback/fire";
import { HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/** Hit area beyond the 32 pt chip so the target reaches 44 pt (direction §3). */
const CHIP_SLOP = (SIZE.touch - SIZE.chipHeight) / 2;

/**
 * Horizontal category chips (C14/C16, Fomo F10/F11): rounded chips in one scrolling row under a tab's title — the
 * selected chip raised with full ink, the rest outlined in quiet ink. A `tick` per change. Selection is a tab role for
 * VoiceOver.
 */
export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  label: string;
}) {
  const { color } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel={label}
      contentContainerStyle={styles.row}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            hitSlop={{ top: CHIP_SLOP, bottom: CHIP_SLOP }}
            onPress={() => {
              if (selected) return;
              fire("tick");
              onChange(o.value);
            }}
            style={[
              styles.chip,
              {
                borderColor: selected ? color.raised2 : color.border,
                backgroundColor: selected ? color.raised2 : color.transparent,
              },
            ]}
          >
            <Text style={[TYPE.buttonCompact, { color: selected ? color.ink : color.text2 }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: SPACE.sm, paddingHorizontal: SIZE.gutter },
  chip: {
    height: SIZE.chipHeight + SPACE.sm,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.sm,
    borderWidth: HAIRLINE_PX,
    justifyContent: "center",
  },
});
