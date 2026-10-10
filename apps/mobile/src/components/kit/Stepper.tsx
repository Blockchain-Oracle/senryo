/**
 * React Native port of 21st:arihantcodes_1f7b8c4d/quantity-stepper (#29940, the web's `quantity-stepper.tsx`): a pill
 * with −, a rolling value and +. The value rolls in the direction of travel (Reanimated layout animations), a press
 * squishes, holding repeats with acceleration, and pushing past min or max shakes the value in the down tone with a
 * haptic. VoiceOver adjusts it as an adjustable control.
 */
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeOutDown,
  FadeOutUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { fire } from "~/feedback/fire";
import { DISABLED_OPACITY, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { Minus, Plus } from "./symbols";
import { usePressScale } from "./usePressScale";

const HOLD_DELAY_MS = 400;
const HOLD_INTERVAL_MS = 80;
const HOLD_FAST_INTERVAL_MS = 40;
const HOLD_FAST_AFTER = 10;
const FLASH_MS = 400;
const ROLL_MS = 160;
const SQUISH = 0.85;
const SHAKE_PX = 4;
const SHAKE_STEP_MS = 50;
const VALUE_MIN_WIDTH = 72;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** What it sets ("Take profit"), for VoiceOver. */
  label: string;
  format?: (value: number) => string;
}

function StepButton(p: { kind: "down" | "up"; dim: boolean; label: string; onIn: () => void; onOut: () => void }) {
  const { color } = useTheme();
  const press = usePressScale(SQUISH);
  const Icon = p.kind === "up" ? Plus : Minus;
  return (
    <Pressable
      accessibilityElementsHidden
      importantForAccessibility="no"
      onPressIn={() => {
        press.onPressIn();
        p.onIn();
      }}
      onPressOut={() => {
        press.onPressOut();
        p.onOut();
      }}
      hitSlop={SPACE.xs}
      accessibilityLabel={p.label}
    >
      <Animated.View style={[styles.button, { opacity: p.dim ? DISABLED_OPACITY : 1 }, press.style]}>
        <Icon size={SIZE.iconSm} color={color.inkMuted} strokeWidth={SIZE.iconStroke} />
      </Animated.View>
    </Pressable>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  label,
  format = String,
}: StepperProps) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const current = clamp(value, min, max);
  const valueRef = useRef(current);
  valueRef.current = current;
  const [direction, setDirection] = useState(1);
  const [flash, setFlash] = useState(false);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const delay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const count = useRef(0);

  const stop = () => {
    if (delay.current !== null) clearTimeout(delay.current);
    if (repeat.current !== null) clearInterval(repeat.current);
    delay.current = null;
    repeat.current = null;
    count.current = 0;
  };
  useEffect(() => stop, []);
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(false), FLASH_MS);
    return () => clearTimeout(id);
  }, [flash]);

  const stepBy = (delta: number): boolean => {
    const next = clamp(valueRef.current + delta, min, max);
    if (next === valueRef.current) {
      setFlash(true);
      fire("warn");
      if (!reduce) {
        const t = { duration: SHAKE_STEP_MS };
        shake.value = withSequence(
          withTiming(-SHAKE_PX, t),
          withTiming(SHAKE_PX, t),
          withTiming(-SHAKE_PX / 2, t),
          withTiming(0, t),
        );
      }
      return false;
    }
    valueRef.current = next;
    setDirection(delta > 0 ? 1 : -1);
    fire("tick");
    onChange(next);
    return true;
  };

  const startHold = (delta: number) => () => {
    stop();
    if (!stepBy(delta)) return;
    delay.current = setTimeout(() => {
      const tick = () => {
        if (!stepBy(delta)) return stop();
        count.current += 1;
        if (count.current === HOLD_FAST_AFTER) {
          if (repeat.current !== null) clearInterval(repeat.current);
          repeat.current = setInterval(tick, HOLD_FAST_INTERVAL_MS);
        }
      };
      repeat.current = setInterval(tick, HOLD_INTERVAL_MS);
    }, HOLD_DELAY_MS);
  };

  const text = format(current);
  const entering = reduce ? undefined : (direction > 0 ? FadeInUp : FadeInDown).duration(ROLL_MS);
  const exiting = reduce ? undefined : (direction > 0 ? FadeOutUp : FadeOutDown).duration(ROLL_MS);
  return (
    <View
      style={[styles.pill, { backgroundColor: color.raised2 }]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => stepBy(e.nativeEvent.actionName === "increment" ? step : -step)}
    >
      <StepButton kind="down" dim={current <= min} label={`Lower ${label}`} onIn={startHold(-step)} onOut={stop} />
      <Animated.View style={[styles.value, shakeStyle]}>
        <Animated.View key={current} {...(entering ? { entering } : {})} {...(exiting ? { exiting } : {})}>
          <Text style={[TYPE.rowTitle, styles.digits, { color: flash ? color.destructive : color.ink }]}>{text}</Text>
        </Animated.View>
      </Animated.View>
      <StepButton kind="up" dim={current >= max} label={`Raise ${label}`} onIn={startHold(step)} onOut={stop} />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    height: SIZE.touch,
    borderRadius: SIZE.touch / 2,
    paddingHorizontal: SPACE.xs,
    gap: SPACE.xs,
  },
  button: {
    width: SIZE.touch - SPACE.sm,
    height: SIZE.touch - SPACE.sm,
    borderRadius: (SIZE.touch - SPACE.sm) / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  value: { minWidth: VALUE_MIN_WIDTH, alignItems: "center", overflow: "hidden" },
  digits: { fontVariant: ["tabular-nums"] },
});
