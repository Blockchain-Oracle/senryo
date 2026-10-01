import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { fire } from "~/feedback/fire";
import { CONTROL_FONT_SCALE, EASE, RADIUS, SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";

/** The visible plate is 28 pt high (Fomo F16, consult §D "Periods"); the target reaches 44 pt through hitSlop. */
const CHIP_HEIGHT = 28;
const CHIP_SLOP = (SIZE.touch - CHIP_HEIGHT) / 2;

interface Box {
  x: number;
  width: number;
}

/**
 * Period chips (Fomo F16's 24h / 7d / 30d / All, F13's 1H … ALL): text-only labels in quiet ink, the selected one on
 * a small neutral plate — 28 pt high, 8 pt corners, 13/18 semibold. Each chip is as wide as its label, so the row is
 * compact and sits right-aligned under a chart. The plate slides to the selection in 170 ms and takes the new label's
 * width; a `tick` per change. Generic and typed like `Segmented`.
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
  /** Group name for VoiceOver ("Chart period"). */
  label: string;
}) {
  const { color } = useTheme();
  const [boxes, setBoxes] = useState<Partial<Record<T, Box>>>({});
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const placed = useRef(false);
  const box = boxes[value];
  const boxX = box?.x;
  const boxWidth = box?.width;
  useEffect(() => {
    if (boxX === undefined || boxWidth === undefined) return;
    // The first placement is where the plate is, not a journey from the left edge.
    if (!placed.current) {
      placed.current = true;
      x.value = boxX;
      width.value = boxWidth;
      return;
    }
    x.value = withTiming(boxX, { duration: TIMING.selection, easing: EASE });
    width.value = withTiming(boxWidth, { duration: TIMING.selection, easing: EASE });
  }, [boxX, boxWidth, x, width]);
  const plate = useAnimatedStyle(() => ({ width: width.value, transform: [{ translateX: x.value }] }));
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={styles.row}>
      <Animated.View style={[styles.plate, { backgroundColor: color.raised2 }, plate]} />
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            hitSlop={{ top: CHIP_SLOP, bottom: CHIP_SLOP }}
            onLayout={(e) => {
              const { x: left, width: wide } = e.nativeEvent.layout;
              setBoxes((prev) => {
                const was = prev[o.value];
                return was && was.x === left && was.width === wide
                  ? prev
                  : { ...prev, [o.value]: { x: left, width: wide } };
              });
            }}
            onPress={() => {
              if (selected) return;
              fire("tick");
              onChange(o.value);
            }}
            style={styles.chip}
          >
            <Text
              maxFontSizeMultiplier={CONTROL_FONT_SCALE}
              style={[TYPE.modeLabel, { color: selected ? color.ink : color.text3 }]}
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
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  plate: { position: "absolute", left: 0, top: 0, height: CHIP_HEIGHT, borderRadius: RADIUS.xs },
  chip: { height: CHIP_HEIGHT, paddingHorizontal: SPACE.md, justifyContent: "center", borderRadius: RADIUS.xs },
});
