/**
 * A tappable piece of the profile (a count, "Add a bio", a person row): it shrinks under the finger and ticks, like
 * every plate in the kit (build brief §4). Text-sized targets get a hit slop up to the 44 pt minimum.
 */
import type { ReactNode } from "react";
import { Pressable, type StyleProp, StyleSheet, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { SPACE } from "~/theme";

/** A wide row barely moves under the finger (0.97 would read as a lurch). */
export const ROW_PRESS_SCALE = 0.985;

export function Tap({
  label,
  hint,
  onPress,
  scale,
  block = false,
  style,
  pressedStyle,
  children,
}: {
  /** The accessible name. */
  label: string;
  hint?: string;
  onPress: () => void;
  scale?: number;
  /** Stretch across the column (a row); by default it hugs its content, so it scales about its own centre. */
  block?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Added while the finger is down (a row's pressed fill). */
  pressedStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const press = usePressScale(scale);
  return (
    <Animated.View style={[block ? styles.block : styles.inline, press.style]}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("tick");
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        {...(hint ? { accessibilityHint: hint } : {})}
        hitSlop={block ? 0 : SPACE.md}
        style={({ pressed }) => [style, pressed ? pressedStyle : null]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  block: { alignSelf: "stretch" },
  inline: { alignSelf: "flex-start" },
});
