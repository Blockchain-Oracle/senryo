/**
 * A disclosure row (ported from 21st.dev ibelick/disclosure, id 851: a trigger that toggles content open and closed,
 * with the content entering on a short fade and the chevron turning): a quiet title row with a chevron; tapping it
 * shows the details under it. Framer Motion's height animation becomes a Reanimated entering fade + layout
 * transition; Reduced Motion is respected by Reanimated. Used for "Technical details" and "Details".
 */
import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, LinearTransition, useReducedMotion } from "react-native-reanimated";
import { ChevronDown } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { CONTROL_FONT_SCALE, SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";

export function Disclosure({
  title,
  children,
  initiallyOpen = false,
}: {
  title: string;
  children: ReactNode;
  initiallyOpen?: boolean;
}) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <Animated.View {...(reduce ? {} : { layout: LinearTransition.duration(TIMING.selection) })}>
      <Pressable
        onPress={() => {
          fire("tick");
          setOpen(!open);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        style={({ pressed }) => [styles.trigger, { opacity: pressed ? PRESSED : 1 }]}
      >
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.row, styles.flex, { color: color.text2 }]}>
          {title}
        </Text>
        <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
          <ChevronDown size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />
        </View>
      </Pressable>
      {open ? (
        <Animated.View {...(reduce ? {} : { entering: FadeIn.duration(TIMING.selection) })} style={styles.body}>
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/** One label/value line inside a disclosure or a Details sheet: quiet label, value at the right. */
export function DetailRow({ label, value, tone }: { label: string; value: string; tone?: string | undefined }) {
  const { color } = useTheme();
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text3 }]}>
        {label}
      </Text>
      <Text
        maxFontSizeMultiplier={CONTROL_FONT_SCALE}
        numberOfLines={1}
        style={[TYPE.rowAmount, styles.value, { color: tone ?? color.ink }]}
      >
        {value}
      </Text>
    </View>
  );
}

const PRESSED = 0.6;

const styles = StyleSheet.create({
  trigger: { flexDirection: "row", alignItems: "center", minHeight: SIZE.touch, gap: SPACE.sm },
  flex: { flex: 1 },
  body: { gap: SPACE.xxs, paddingBottom: SPACE.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACE.lg,
    minHeight: SIZE.touch - SPACE.sm,
  },
  value: { flexShrink: 1, textAlign: "right" },
});
