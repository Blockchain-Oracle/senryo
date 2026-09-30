import { Pressable, StyleSheet, Text, View } from "react-native";
import { fire } from "~/feedback/fire";
import { HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/** RN port of 21st Segmented Control #23552 (asset filter, Long/Short, timeframe): a `tick` on every change. */
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
            style={[styles.cell, selected ? { backgroundColor: color.foreground } : null]}
          >
            <Text
              style={[
                TYPE.numSm,
                styles.text,
                { color: selected ? (tone?.(o.value) ?? color.background) : color.inkMuted },
              ]}
            >
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
    borderRadius: RADIUS.sm,
    borderWidth: HAIRLINE_PX,
  },
  cell: {
    flex: 1,
    minHeight: SIZE.touch - SPACE.md,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.sm,
  },
  text: { textTransform: "uppercase" },
});
