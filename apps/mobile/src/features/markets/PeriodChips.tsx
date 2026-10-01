import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/** Period chips are 28 pt high (controls consult §D "Periods"; F16/F32); the hit area still reaches 44 pt. */
const PERIOD_HEIGHT = 28;
const PERIOD_SLOP = (SIZE.touch - PERIOD_HEIGHT) / 2;

/**
 * Chart period chips (Fomo F32 "1D 1W 3M …", F16; controls consult §D): text only, spread across the row; the
 * selected one sits on a neutral 8 pt-corner plate in full ink. No outlines. A `tick` per change.
 */
export function PeriodChips<T extends string>({
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
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={styles.row}>
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
    </View>
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
        hitSlop={{ top: PERIOD_SLOP, bottom: PERIOD_SLOP, left: SPACE.xs, right: SPACE.xs }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={onPress}
        style={[styles.chip, { backgroundColor: selected ? color.raised2 : color.transparent }]}
      >
        <Text style={[TYPE.modeLabel, { color: selected ? color.ink : color.text3 }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chip: {
    height: PERIOD_HEIGHT,
    minWidth: SIZE.touch,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.xs,
    alignItems: "center",
    justifyContent: "center",
  },
});
