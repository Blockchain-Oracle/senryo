/**
 * Hold-to-confirm — RN port of 21st kokonutd/hold-and-release-button (#8), D2 tokens (web twin:
 * apps/web/src/components/ui/hold-and-release-button.tsx). A solid primary button; holding for `HOLD_TO_CONFIRM_MS`
 * sweeps a lighter fill left→right (linear) and fires `onConfirm` once. `press` haptic at press-in, `confirm` on
 * completion; an early release springs back silently (F10 step 4). Reduce Motion keeps the timer, skips the sweep.
 * VoiceOver: the `activate` action confirms directly (a hold gesture isn't available to screen-reader users).
 */
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { fire } from "~/feedback/fire";
import { DISABLED_OPACITY, DURATION, FONT, HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

export const HOLD_TO_CONFIRM_MS = 500;
/** The fill is the button's ink at this opacity over the primary plate (web: primary-foreground/30). */
const FILL_OPACITY = 0.3;
const PERCENT = 100;

interface Props {
  label: string;
  holdingLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
}

export function HoldToConfirm({
  label,
  holdingLabel = "Keep holding…",
  onConfirm,
  disabled,
  accessibilityHint,
}: Props) {
  const { color } = useTheme();
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  const [holding, setHolding] = useState(false);
  const done = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const complete = useCallback(() => {
    if (done.current) return;
    done.current = true;
    setHolding(false);
    fire("confirm");
    onConfirm();
  }, [onConfirm]);

  const start = () => {
    if (disabled) return;
    done.current = false;
    setHolding(true);
    fire("press");
    if (reduced) {
      timer.current = setTimeout(complete, HOLD_TO_CONFIRM_MS);
      return;
    }
    progress.value = withTiming(1, { duration: HOLD_TO_CONFIRM_MS, easing: Easing.linear }, (finished) => {
      if (finished) scheduleOnRN(complete);
    });
  };

  const end = () => {
    clearTimeout(timer.current);
    if (done.current) {
      progress.value = 0;
      return;
    }
    setHolding(false);
    cancelAnimation(progress);
    progress.value = withTiming(0, { duration: reduced ? 0 : DURATION.fast });
  };

  const fill = useAnimatedStyle(() => ({ width: `${progress.value * PERCENT}%` }));

  return (
    <Pressable
      onPressIn={start}
      onPressOut={end}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint ?? "Double-tap to confirm"}
      accessibilityState={{ disabled: Boolean(disabled) }}
      accessibilityActions={[{ name: "activate" }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "activate" && !disabled) complete();
      }}
      style={[
        styles.button,
        { backgroundColor: color.primary, borderColor: color.primary },
        disabled ? { opacity: DISABLED_OPACITY } : null,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.fill, { backgroundColor: color.primaryForeground, opacity: FILL_OPACITY }, fill]}
      />
      <View style={styles.center} pointerEvents="none">
        <Text style={[styles.label, { color: color.primaryForeground }]} numberOfLines={1}>
          {holding ? holdingLabel : label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: SIZE.buttonHeight,
    borderRadius: RADIUS.sm,
    borderWidth: HAIRLINE_PX,
    overflow: "hidden",
    justifyContent: "center",
  },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0 },
  center: { alignItems: "center", paddingHorizontal: SPACE.lg },
  label: { ...TYPE.numSm, fontFamily: FONT.monoStrong, textTransform: "uppercase" },
});
