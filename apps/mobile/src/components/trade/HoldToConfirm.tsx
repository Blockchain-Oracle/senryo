/** Native slide-to-confirm; legacy export preserves the existing caller safety contract. */
import { ArrowRight } from "lucide-react-native";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AccessibilityInfo, Alert, AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { fire } from "~/feedback/fire";
import { BUTTON, CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const RAIL_HEIGHT = 56;
const THUMB = 48;
const INSET = 4;
const ACTIVATE_X = 8;
const CANCEL_Y = 12;
const COMMIT_FRACTION = 0.9;
const RESET_SPRING = { damping: 28, stiffness: 280, mass: 0.7, overshootClamping: true };
interface Props {
  label: string;
  holdingLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
  resetKey?: string;
  onReset?: () => void;
  onAccessibleActivate?: () => void;
}

export function HoldToConfirm({ label, onConfirm, disabled, resetKey, onReset, onAccessibleActivate }: Props) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const travel = useSharedValue(0);
  const width = useSharedValue(0);
  const epoch = useSharedValue(0);
  const gestureEpoch = useSharedValue(0);
  const active = useSharedValue(false);
  const [reader, setReader] = useState(false);
  const alive = useRef(true);
  const done = useRef(false);
  const current = useRef({ disabled, onConfirm, onReset });
  current.current = { disabled, onConfirm, onReset };
  const action = label.replace(/^Hold to /i, "").replace(/^Slide to /i, "");
  const cancel = useCallback(() => {
    epoch.value += 1;
    active.value = false;
    cancelAnimation(travel);
    travel.value = 0;
  }, [active, epoch, travel]);
  useLayoutEffect(() => {
    const wasActive = active.value;
    cancel();
    done.current = false;
    if (wasActive) current.current.onReset?.();
  }, [resetKey, disabled, active, cancel]);
  useEffect(() => {
    alive.current = true;
    void AccessibilityInfo.isScreenReaderEnabled().then(setReader);
    const readerSub = AccessibilityInfo.addEventListener("screenReaderChanged", setReader);
    const stateSub = AppState.addEventListener("change", (state) => {
      if (state !== "active") cancel();
    });
    return () => {
      alive.current = false;
      cancel();
      readerSub.remove();
      stateSub.remove();
    };
  }, [cancel]);
  const commit = (attempt: number) => {
    if (
      !alive.current ||
      done.current ||
      current.current.disabled ||
      attempt !== epoch.value ||
      AppState.currentState !== "active"
    )
      return;
    done.current = true;
    fire("confirm");
    current.current.onConfirm();
  };
  const review = () => {
    if (disabled) return;
    if (onAccessibleActivate) return onAccessibleActivate();
    const attempt = epoch.value;
    Alert.alert("Confirm", action, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", onPress: () => commit(attempt) },
    ]);
  };
  const pan = Gesture.Pan()
    .enabled(!disabled && !reader)
    .maxPointers(1)
    .activeOffsetX([-ACTIVATE_X, ACTIVATE_X])
    .failOffsetY([-CANCEL_Y, CANCEL_Y])
    .onBegin(() => {
      cancelAnimation(travel);
      gestureEpoch.value = epoch.value;
      active.value = true;
    })
    .onUpdate((event) => {
      if (gestureEpoch.value !== epoch.value) return;
      travel.value = Math.max(0, Math.min(width.value, event.translationX));
    })
    .onEnd((_event, success) => {
      if (
        success &&
        active.value &&
        gestureEpoch.value === epoch.value &&
        width.value > 0 &&
        travel.value >= width.value * COMMIT_FRACTION
      ) {
        active.value = false;
        scheduleOnRN(commit, gestureEpoch.value);
      } else travel.value = reduce ? 0 : withSpring(0, RESET_SPRING);
    })
    .onFinalize(() => {
      active.value = false;
      travel.value = reduce ? 0 : withSpring(0, RESET_SPRING);
    });
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: travel.value }] }));
  const copy = useAnimatedStyle(() => ({ opacity: width.value > 0 ? 1 - travel.value / width.value : 1 }));
  return (
    <View
      accessible={!reader}
      accessibilityRole="button"
      accessibilityLabel={`Review and confirm: ${action}`}
      accessibilityState={{ disabled: Boolean(disabled) }}
      accessibilityActions={[{ name: "activate", label: "Review and confirm" }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "activate") review();
      }}
      onLayout={(event) => {
        width.value = Math.max(0, event.nativeEvent.layout.width - THUMB - INSET * 2);
      }}
      style={[styles.rail, { backgroundColor: disabled ? color.raised2 : color.primary }]}
    >
      <Animated.View pointerEvents="none" style={[styles.copy, copy]}>
        <Text
          maxFontSizeMultiplier={CONTROL_FONT_SCALE}
          numberOfLines={1}
          style={[TYPE.buttonLabel, { color: disabled ? color.text3 : color.primaryForeground }]}
        >
          {disabled ? action : `Slide to ${action.charAt(0).toLowerCase()}${action.slice(1)}`}
        </Text>
      </Animated.View>
      {reader ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={review}
          accessibilityRole="button"
          accessibilityLabel={`Review and confirm: ${action}`}
          accessibilityState={{ disabled: Boolean(disabled) }}
          disabled={disabled}
        />
      ) : (
        <GestureDetector gesture={pan}>
          <Animated.View
            style={[styles.thumb, { backgroundColor: disabled ? color.muted : color.primaryForeground }, thumb]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <ArrowRight size={SIZE.icon} color={disabled ? color.text3 : color.primary} />
          </Animated.View>
        </GestureDetector>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  rail: { height: RAIL_HEIGHT, borderRadius: BUTTON.radius.md, justifyContent: "center", overflow: "hidden" },
  thumb: {
    position: "absolute",
    left: INSET,
    top: INSET,
    width: THUMB,
    height: THUMB,
    borderRadius: BUTTON.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { alignItems: "center", paddingLeft: THUMB + SPACE.sm, paddingRight: SPACE.md },
});
