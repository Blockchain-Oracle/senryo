/**
 * Tradash's floating order stack on the phone (Codex direction 11 §2, R5.4): flush to the chart's left edge, four rows
 * of glyph and value under the instrument's name — a call's Stake · Pays · Fees · Exit, a ride's Margin · Leverage ·
 * Fees · Trail. It peeks in from the edge, drags up and down within the chart, and a tap opens the order's settings.
 */
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeInLeft, type SharedValue, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { GlassPlate } from "~/components/kit/GlassPlate";
import { LiveText } from "~/components/kit/LiveText";
import { Coins, Crosshair, Gauge, Percent, Plunge } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { SPACE, TYPE, useTheme } from "~/theme";

const WIDTH = 160;
const ROW_H = 28;
const GLYPH = 14;
const RADIUS = 16;
const PEEK_DELAY_MS = 350;
const PEEK_MS = 400;
const HALF = 2;

export interface StackRow {
  icon: "coins" | "gauge" | "fees" | "exit" | "trail";
  label: string;
  value: string | SharedValue<string>;
}

const ICONS = { coins: Coins, gauge: Gauge, fees: Percent, exit: Crosshair, trail: Plunge } as const;

export function OrderStack({
  heading,
  rows,
  height,
  onOpen,
}: {
  heading: string;
  rows: readonly StackRow[];
  /** The chart's height: the drag stays inside it. */
  height: number;
  onOpen: () => void;
}) {
  const { color } = useTheme();
  const y = useSharedValue(0);
  const start = useSharedValue(0);
  const stackH = ROW_H * (rows.length + 1) + SPACE.sm * HALF;
  const room = Math.max(0, (height - stackH) / HALF);
  const pan = Gesture.Pan()
    .activeOffsetY([-SPACE.sm, SPACE.sm])
    .onBegin(() => {
      start.value = y.value;
    })
    .onUpdate((e) => {
      y.value = Math.max(-room, Math.min(room, start.value + e.translationY));
    });
  const tap = Gesture.Tap().onEnd(() => {
    scheduleOnRN(fire, "tick");
    scheduleOnRN(onOpen);
  });
  const moved = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <Animated.View
        entering={FadeInLeft.delay(PEEK_DELAY_MS).duration(PEEK_MS)}
        style={[styles.anchor, { top: height / HALF - stackH / HALF }, moved]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${heading} settings: ${rows.map((r) => r.label).join(", ")}`}
      >
        <GlassPlate style={styles.plate}>
          <Text style={[TYPE.micro, styles.heading, { color: color.text3 }]}>{heading.toUpperCase()}</Text>
          {rows.map((r) => {
            const Icon = ICONS[r.icon];
            return (
              <View key={r.label} style={styles.row}>
                <Icon size={GLYPH} color={color.inkMuted} />
                {typeof r.value === "string" ? (
                  <Text numberOfLines={1} style={[TYPE.micro, styles.value, { color: color.ink }]}>
                    {r.value}
                  </Text>
                ) : (
                  <LiveText text={r.value} style={[TYPE.micro, styles.value, { color: color.ink }]} />
                )}
              </View>
            );
          })}
        </GlassPlate>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  anchor: { position: "absolute", left: 0, width: WIDTH },
  plate: {
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.sm,
    borderTopRightRadius: RADIUS,
    borderBottomRightRadius: RADIUS,
    overflow: "hidden",
  },
  heading: { paddingHorizontal: SPACE.xs, letterSpacing: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, height: ROW_H, paddingHorizontal: SPACE.xs },
  value: { flexShrink: 1, fontVariant: ["tabular-nums"] },
});
