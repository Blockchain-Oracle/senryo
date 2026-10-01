/**
 * Hold to confirm (D-177; C43 → the 500 ms hold pill that replaces Fomo's slider, which is only ever shown disabled).
 * RN port of 21st kokonutd/hold-and-release-button (#8), Living Lacquer: a primary pill; holding for 500 ms sweeps a
 * lighter fill left→right (linear) and fires `onConfirm` once. `press` haptic at press-in, `confirm` on completion.
 * Disabled, the pill shows its reason on the quiet surface ("Enter an amount", "Insufficient funds").
 * Resets (Codex S1b.7 consult #3): an early release, a change of `resetKey` mid-hold (the order's identity — price,
 * amount, side, leverage, account, mode), the app going to the background, or the control being disabled mid-hold
 * all cancel the hold and invalidate any queued completion; a fresh press is required. Reduce Motion keeps the timer,
 * skips the sweep. VoiceOver can't hold: `activate` calls `onAccessibleActivate` (the ticket opens its review) or, if
 * absent, confirms directly.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
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
import { DURATION, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

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
  /** The identity of what is being confirmed; a change while holding cancels the hold (`onReset`). */
  resetKey?: string;
  onReset?: () => void;
  onAccessibleActivate?: () => void;
}

export function HoldToConfirm({
  label,
  holdingLabel = "Keep holding…",
  onConfirm,
  disabled,
  accessibilityHint,
  resetKey,
  onReset,
  onAccessibleActivate,
}: Props) {
  const { color } = useTheme();
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  const [holding, setHolding] = useState(false);
  const attempt = useRef(0);
  const done = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const complete = useCallback(
    (id: number) => {
      if (done.current || id !== attempt.current) return;
      done.current = true;
      setHolding(false);
      fire("confirm");
      onConfirm();
    },
    [onConfirm],
  );

  /** Stops the hold without confirming: a new attempt id voids any completion already queued. */
  const cancel = useCallback(
    (animate: boolean) => {
      attempt.current += 1;
      clearTimeout(timer.current);
      setHolding(false);
      cancelAnimation(progress);
      progress.value = animate && !reduced ? withTiming(0, { duration: DURATION.fast }) : 0;
    },
    [progress, reduced],
  );

  const start = () => {
    if (disabled) return;
    attempt.current += 1;
    const id = attempt.current;
    done.current = false;
    setHolding(true);
    fire("press");
    if (reduced) {
      timer.current = setTimeout(() => complete(id), HOLD_TO_CONFIRM_MS);
      return;
    }
    progress.value = withTiming(1, { duration: HOLD_TO_CONFIRM_MS, easing: Easing.linear }, (finished) => {
      if (finished) scheduleOnRN(complete, id);
    });
  };

  const end = () => {
    if (done.current) {
      progress.value = 0;
      return;
    }
    cancel(true);
  };

  // The thing being confirmed changed under the finger: cancel and say why (the ticket shows the reset copy).
  const key = useRef(resetKey);
  useEffect(() => {
    if (key.current === resetKey) return;
    key.current = resetKey;
    if (holding) {
      cancel(false);
      onReset?.();
    }
  }, [resetKey, holding, cancel, onReset]);

  useEffect(() => {
    if (disabled && holding) cancel(false);
  }, [disabled, holding, cancel]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") cancel(false);
    });
    return () => sub.remove();
  }, [cancel]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.value * PERCENT}%` }));

  return (
    <Pressable
      onPressIn={start}
      onPressOut={end}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint ?? "Double-tap to confirm"}
      accessibilityState={{ disabled: Boolean(disabled), busy: holding }}
      accessibilityActions={[{ name: "activate" }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName !== "activate" || disabled) return;
        if (onAccessibleActivate) onAccessibleActivate();
        else complete(attempt.current);
      }}
      style={[styles.button, { backgroundColor: disabled ? color.raised2 : color.primary }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.fill, { backgroundColor: color.primaryForeground, opacity: FILL_OPACITY }, fill]}
      />
      <View style={styles.center} pointerEvents="none">
        <Text style={[TYPE.buttonLabel, { color: disabled ? color.text3 : color.primaryForeground }]} numberOfLines={1}>
          {holding ? holdingLabel : label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: SIZE.buttonHeight,
    borderRadius: RADIUS.pill,
    overflow: "hidden",
    justifyContent: "center",
  },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0 },
  center: { alignItems: "center", paddingHorizontal: SPACE.lg },
});
