/**
 * An action circle (D-196 / Part A rule 6: 56 pt disc + label under it; Phantom P19, Fomo F16). Busy behaviour ported
 * from 21st.dev Codehagen/action-button (id 1051): the glyph and the spinner share one slot, so the circle never
 * changes size while its action runs — the glyph hides, the spinner shows in its place. Press shrinks to 0.97 with a
 * tick; disabled dims. A `locked` circle keeps its label and says why through its accessibility hint.
 */
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { CONTROL_FONT_SCALE, DISABLED_OPACITY, RADIUS, SPACE, TYPE, useTheme } from "~/theme";

/** The disc (D-196) and the glyph inside it. */
export const ACTION_CIRCLE = 56;
export const ACTION_GLYPH = 24;

export function ActionCircle({
  label,
  onPress,
  children,
  busy = false,
  disabled = false,
  active = false,
  hint,
}: {
  label: string;
  onPress: () => void;
  /** The glyph (a `components/kit/symbols` icon at ACTION_GLYPH). */
  children: ReactNode;
  busy?: boolean;
  disabled?: boolean;
  /** A held state (Frozen): the disc fills with the primary wash. */
  active?: boolean;
  hint?: string;
}) {
  const { color } = useTheme();
  const press = usePressScale();
  const inert = busy || disabled;
  return (
    <View style={[styles.cell, disabled ? styles.dim : null]}>
      <Animated.View style={press.style}>
        <Pressable
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          onPress={() => {
            fire("tick");
            onPress();
          }}
          disabled={inert}
          accessibilityRole="button"
          accessibilityLabel={label}
          {...(hint ? { accessibilityHint: hint } : {})}
          accessibilityState={{ disabled: inert, busy }}
          style={({ pressed }) => [
            styles.disc,
            {
              backgroundColor: pressed ? color.rowPressed : active ? color.primaryWashStrong : color.raised2,
            },
          ]}
        >
          <View style={[styles.slot, busy ? styles.hidden : null]}>{children}</View>
          {busy ? <ActivityIndicator style={StyleSheet.absoluteFill} color={color.ink} /> : null}
        </Pressable>
      </Animated.View>
      <Text
        maxFontSizeMultiplier={CONTROL_FONT_SCALE}
        numberOfLines={1}
        style={[TYPE.meta, styles.label, { color: color.text2 }]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { flex: 1, alignItems: "center", gap: SPACE.sm },
  dim: { opacity: DISABLED_OPACITY },
  disc: {
    width: ACTION_CIRCLE,
    height: ACTION_CIRCLE,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  slot: { alignItems: "center", justifyContent: "center" },
  hidden: { opacity: 0 },
  label: { textAlign: "center" },
});
