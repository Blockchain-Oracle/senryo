import { Pressable, StyleSheet, Text, View } from "react-native";
import { fire } from "~/feedback/fire";
import { HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/**
 * RN port of 21st Segmented Control #23552 (asset filter, Long/Short, timeframe): a `tick` on every change. Living
 * Lacquer (S1b.7): pill track and cells, sentence-case labels, the raised cell marks the selection.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  tone,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  /** Group name for VoiceOver ("Asset class"). */
  label: string;
  /** Colour of the selected cell's text (Long green / Short red); defaults to the ground. */
  tone?: (value: T) => string;
}) {
  const { color } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={[styles.track, { backgroundColor: color.muted, borderColor: color.hairline }]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              fire("tick");
              onChange(o.value);
            }}
            style={[styles.cell, selected ? { backgroundColor: color.raised2 } : null]}
          >
            <Text style={[TYPE.chipLabel, { color: selected ? (tone?.(o.value) ?? color.ink) : color.text3 }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    padding: SPACE.xs,
    gap: SPACE.xs,
    borderRadius: RADIUS.pill,
    borderWidth: HAIRLINE_PX,
  },
  cell: {
    flex: 1,
    minHeight: SIZE.chipHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.pill,
  },
});
