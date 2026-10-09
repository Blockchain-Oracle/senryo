/**
 * React Native port of 21st:ddoemonn/swipe-deck (#23568, the web's `swipe-deck.tsx`): a Tinder-style deck — drag the
 * top card past the threshold (or flick it) to decide, or press one of the two buttons — the next cards stacked
 * behind and rising as the top one travels, its decision badges growing with the drag, a haptic detent where release
 * would decide. Controlled like the web's: `items` are the undecided cards, so a card leaves only when its decision
 * lands; no undo. VoiceOver gets the two decisions as actions on the card. Reduce Motion drops the travel.
 */
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { fire } from "~/feedback/fire";
import { BUTTON, DISABLED_OPACITY, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { usePressScale } from "./usePressScale";

const THRESHOLD = 92;
const FLICK = 520;
const FLICK_SHARE = 0.35;
const ACTIVATE_X = 8;
const CANCEL_Y = 14;
const EXIT_DISTANCE = 560;
const EXIT_MS = 300;
const ROTATE_AT = 200;
const ROTATE_DEG = 8;
const DEPTH_Y = 10;
const DEPTH_SCALE = 0.045;
const PEEK = 3;
const RETURN = { damping: 27, stiffness: 150, mass: 1 };

export type SwipeSide = "left" | "right";

export interface SwipeDeckProps<T> {
  items: readonly T[];
  itemKey: (item: T) => string;
  itemLabel: (item: T) => string;
  children: (item: T) => ReactNode;
  onDecide: (item: T, side: SwipeSide) => void;
  leftLabel: string;
  rightLabel: string;
  busy?: boolean;
  emptyLabel: string;
  height: number;
}

export function SwipeDeck<T>(p: SwipeDeckProps<T>) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const x = useSharedValue(0);
  const armed = useSharedValue(0);
  const current = p.items[0];
  const stack = p.items.slice(0, PEEK);

  const decide = (side: SwipeSide) => {
    if (p.busy || !current) return;
    fire("press");
    p.onDecide(current, side);
    x.value = 0;
  };
  const leave = (side: SwipeSide) => {
    const to = side === "right" ? EXIT_DISTANCE : -EXIT_DISTANCE;
    x.value = reduce ? 0 : withTiming(to, { duration: EXIT_MS }, () => scheduleOnRN(decide, side));
    if (reduce) decide(side);
  };
  const detent = () => fire("tick");

  const pan = Gesture.Pan()
    .enabled(!p.busy && current !== undefined)
    .activeOffsetX([-ACTIVATE_X, ACTIVATE_X])
    .failOffsetY([-CANCEL_Y, CANCEL_Y])
    .onUpdate((e) => {
      x.value = e.translationX;
      const past = Math.abs(e.translationX) >= THRESHOLD ? 1 : 0;
      if (past !== armed.value) {
        armed.value = past;
        if (past) scheduleOnRN(detent);
      }
    })
    .onEnd((e) => {
      armed.value = 0;
      const far = Math.abs(e.translationX) >= THRESHOLD;
      const fast = Math.abs(e.velocityX) >= FLICK && Math.abs(e.translationX) >= THRESHOLD * FLICK_SHARE;
      if (!far && !fast) {
        x.value = withSpring(0, RETURN);
        return;
      }
      const right = (far ? e.translationX : e.velocityX) > 0;
      scheduleOnRN(leave, right ? "right" : "left");
    });

  return (
    <View style={styles.wrap}>
      <View style={{ height: p.height + DEPTH_Y * (PEEK - 1) }}>
        {current === undefined ? (
          <View style={[styles.empty, { height: p.height, backgroundColor: color.raised2 }]}>
            <Text style={[TYPE.body, { color: color.inkMuted }]}>{p.emptyLabel}</Text>
          </View>
        ) : null}
        {[...stack].reverse().map((item) => {
          const depth = stack.indexOf(item);
          return depth === 0 ? (
            <GestureDetector key={p.itemKey(item)} gesture={pan}>
              <TopCard
                x={x}
                height={p.height}
                label={p.itemLabel(item)}
                leftLabel={p.leftLabel}
                rightLabel={p.rightLabel}
                onDecide={decide}
              >
                {p.children(item)}
              </TopCard>
            </GestureDetector>
          ) : (
            <BehindCard key={p.itemKey(item)} x={x} depth={depth} height={p.height}>
              {p.children(item)}
            </BehindCard>
          );
        })}
      </View>
      <View style={styles.buttons}>
        <DeckButton
          label={`← ${p.leftLabel}`}
          tone="down"
          disabled={!current || p.busy === true}
          onPress={() => leave("left")}
        />
        <DeckButton
          label={`${p.rightLabel} →`}
          tone="up"
          disabled={!current || p.busy === true}
          onPress={() => leave("right")}
        />
      </View>
    </View>
  );
}

function TopCard(p: {
  x: SharedValue<number>;
  height: number;
  label: string;
  leftLabel: string;
  rightLabel: string;
  onDecide: (side: SwipeSide) => void;
  children: ReactNode;
}) {
  const { color } = useTheme();
  const card = useAnimatedStyle(() => ({
    transform: [
      { translateX: p.x.value },
      { rotate: `${interpolate(p.x.value, [-ROTATE_AT, 0, ROTATE_AT], [-ROTATE_DEG, 0, ROTATE_DEG])}deg` },
    ],
  }));
  const right = useAnimatedStyle(() => ({ opacity: interpolate(p.x.value, [0, THRESHOLD], [0, 1], "clamp") }));
  const left = useAnimatedStyle(() => ({ opacity: interpolate(p.x.value, [-THRESHOLD, 0], [1, 0], "clamp") }));
  return (
    <Animated.View
      accessible
      accessibilityLabel={p.label}
      accessibilityActions={[
        { name: "left", label: p.leftLabel },
        { name: "right", label: p.rightLabel },
      ]}
      onAccessibilityAction={(e) => p.onDecide(e.nativeEvent.actionName === "right" ? "right" : "left")}
      style={[styles.card, { height: p.height, backgroundColor: color.card, zIndex: PEEK }, card]}
    >
      {p.children}
      <Animated.Text style={[styles.badge, styles.badgeLeft, TYPE.chipLabel, { color: color.down }, left]}>
        {p.leftLabel.toUpperCase()}
      </Animated.Text>
      <Animated.Text style={[styles.badge, styles.badgeRight, TYPE.chipLabel, { color: color.up }, right]}>
        {p.rightLabel.toUpperCase()}
      </Animated.Text>
    </Animated.View>
  );
}

function BehindCard(p: { x: SharedValue<number>; depth: number; height: number; children: ReactNode }) {
  const { color } = useTheme();
  const style = useAnimatedStyle(() => {
    const rise = p.depth === 1 ? interpolate(Math.abs(p.x.value), [0, THRESHOLD], [0, 1], "clamp") : 0;
    return {
      transform: [
        { translateY: p.depth * DEPTH_Y - rise * DEPTH_Y },
        { scale: 1 - p.depth * DEPTH_SCALE + rise * DEPTH_SCALE },
      ],
    };
  });
  return (
    <Animated.View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.card, { height: p.height, backgroundColor: color.card, zIndex: PEEK - p.depth }, style]}
    >
      {p.children}
    </Animated.View>
  );
}

function DeckButton(p: { label: string; tone: "up" | "down"; disabled: boolean; onPress: () => void }) {
  const { color } = useTheme();
  const press = usePressScale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: p.disabled }}
      disabled={p.disabled}
      onPress={p.onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={styles.flex}
    >
      <Animated.View
        style={[
          styles.button,
          {
            backgroundColor: p.tone === "up" ? color.upWash : color.downWash,
            opacity: p.disabled ? DISABLED_OPACITY : 1,
          },
          press.style,
        ]}
      >
        <Text style={[TYPE.buttonLabel, { color: p.tone === "up" ? color.up : color.down }]}>{p.label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.md },
  flex: { flex: 1 },
  card: { position: "absolute", left: 0, right: 0, top: 0, borderRadius: RADIUS.lg, overflow: "hidden" },
  empty: { alignItems: "center", justifyContent: "center", borderRadius: RADIUS.lg, paddingHorizontal: SPACE.md },
  badge: { position: "absolute", top: SPACE.md },
  badgeLeft: { left: SPACE.md },
  badgeRight: { right: SPACE.md },
  buttons: { flexDirection: "row", gap: SPACE.md },
  button: {
    height: SIZE.buttonHeight,
    borderRadius: BUTTON.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
