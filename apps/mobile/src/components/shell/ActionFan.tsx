import { BlurView } from "expo-blur";
import { useCallback, useEffect, useState } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { ArrowLeftRight, CirclePlus, type LucideIcon, Plus, QrCode, Send } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import {
  DOCK,
  dockBottom,
  EASE,
  ELEVATION,
  FAN,
  FAN_TOGGLE_DEG,
  HAIRLINE_PX,
  RADIUS,
  SIZE,
  SPACE,
  SPRING,
  TIMING,
  TYPE,
  useTheme,
} from "~/theme";
import { FAN_ACTIONS, FAN_BLUR_INTENSITY, FAN_ITEM_FROM_SCALE, FAN_LABEL, type FanAction } from "./constants";
import { useDock } from "./dock-context";
import { useReduceTransparency } from "./useReduceTransparency";

/**
 * The Phantom action fan (C18/FT055, P19/M06; direction §5): the plus beside the dock (P12) opens a strong
 * live blur (expo-blur + the fan scrim) and four lavender circles that rise and scale from the plus into a right
 * column — Send · Receive · Add money · Swap, 72 pt apart, labels to their left — while the plus turns into ×.
 * The plus shows wherever the dock does. Motion (§5.4): 200 ms per item, 25 ms stagger, spring 1/420/30 with Send's small overshoot; backdrop 160 ms;
 * plus→× 180 ms; exit ~180 ms in reverse (Swap first). Reduce Motion: a ~100 ms crossfade, no travel. Reduce
 * Transparency: an opaque backdrop. Dismissal (×, backdrop, Android back) restores the page under it untouched
 * (FT061); choosing an action closes the fan and opens its destination over the same page (M07).
 */
const ICON: Record<FanAction, LucideIcon> = { send: Send, receive: QrCode, addMoney: CirclePlus, swap: ArrowLeftRight };
const LAST = FAN_ACTIONS.length;

export function ActionFan({ onAction }: { onAction: (action: FanAction) => void }) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const dock = useDock();
  // The plus shares the dock's row, and leaves with it during transaction entry.
  const hidden = dock.hidden;
  const press = usePressScale();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const progress = useSharedValue(0);
  const items = [useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0)] as const;
  // The plus is centred on the dock's height.
  const bottom = dockBottom(insets.bottom) + (DOCK.height - FAN.trigger) / 2;
  const drop = bottom + FAN.trigger + SPACE.lg;
  const away = useSharedValue(hidden ? drop : 0);

  useEffect(() => {
    away.value = withTiming(hidden ? drop : 0, { duration: reduce ? TIMING.reducedMotion : TIMING.selection });
  }, [hidden, drop, away, reduce]);

  const show = useCallback(() => {
    fire("press");
    setMounted(true);
    setOpen(true);
    progress.value = withTiming(1, { duration: reduce ? TIMING.reducedMotion : TIMING.fanBackdrop, easing: EASE });
    items.forEach((item, i) => {
      const spring = i === 0 ? SPRING.fanLead : SPRING.fan;
      item.value = reduce
        ? withTiming(1, { duration: TIMING.reducedMotion })
        : withDelay(i * TIMING.fanStagger, withSpring(1, spring));
    });
  }, [items, progress, reduce]);

  const hide = useCallback(
    (after?: () => void) => {
      setOpen(false);
      const total = reduce ? TIMING.reducedMotion : TIMING.fanExit;
      items.forEach((item, i) => {
        const order = LAST - 1 - i;
        item.value = reduce
          ? withTiming(0, { duration: TIMING.reducedMotion })
          : withDelay(order * TIMING.fanExitStagger, withTiming(0, { duration: TIMING.fanExitItem, easing: EASE }));
      });
      // The backdrop clears with the last item (default in-out easing), so circles never float over a sharp page.
      progress.value = withTiming(0, { duration: total }, (done) => {
        if (done) scheduleOnRN(setMounted, false);
      });
      after?.();
    },
    [items, progress, reduce],
  );

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      hide();
      return true;
    });
    return () => sub.remove();
  }, [open, hide]);

  // Leaving the root (a push, a tab switch, transaction entry) closes an open fan rather than stranding it.
  useEffect(() => {
    if (hidden && open) hide();
  }, [hidden, open, hide]);

  const backdrop = useAnimatedStyle(() => ({ opacity: progress.value }));
  const toggle = useAnimatedStyle(() => ({ transform: [{ rotate: `${progress.value * FAN_TOGGLE_DEG}deg` }] }));
  const plusTone = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const closeTone = useAnimatedStyle(() => ({ opacity: progress.value }));
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: away.value }] }));

  return (
    <>
      {mounted ? (
        <Animated.View style={[StyleSheet.absoluteFill, backdrop]} accessibilityViewIsModal={open}>
          <FanBackdrop onDismiss={() => hide()} />
          <View pointerEvents="box-none" style={[styles.column, { bottom: bottom + (FAN.trigger + FAN.spacing) / 2 }]}>
            {FAN_ACTIONS.map((action, i) => (
              <FanItem
                key={action}
                action={action}
                index={i}
                progress={items[i] as SharedValue<number>}
                enabled={open}
                onPress={() => {
                  fire("tick");
                  hide(() => onAction(action));
                }}
              />
            ))}
          </View>
        </Animated.View>
      ) : null}
      <Animated.View
        pointerEvents={hidden ? "none" : "box-none"}
        style={[styles.trigger, ELEVATION.dock, { bottom, right: FAN.triggerRight }, lift]}
      >
        <Animated.View style={[styles.hit, press.style]}>
          <Pressable
            onPressIn={press.onPressIn}
            onPressOut={press.onPressOut}
            onPress={() => (open ? hide() : show())}
            accessibilityRole="button"
            accessibilityLabel={open ? "Close quick actions" : "Quick actions"}
            accessibilityHint={open ? undefined : "Send, receive, add money or swap"}
            accessibilityState={{ expanded: open }}
            style={[styles.hit, styles.centered]}
          >
            <Animated.View style={[styles.disc, { backgroundColor: color.fanCircle }, plusTone]} />
            <Animated.View
              style={[
                styles.disc,
                { backgroundColor: color.raised2, borderColor: color.glassRim },
                styles.rim,
                closeTone,
              ]}
            />
            <Animated.View style={toggle}>
              <Plus size={FAN.triggerIcon} strokeWidth={SIZE.iconStroke} color={open ? color.ink : color.fanText} />
            </Animated.View>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </>
  );
}

function FanBackdrop({ onDismiss }: { onDismiss: () => void }) {
  const { color, name } = useTheme();
  const opaque = useReduceTransparency();
  return (
    <Pressable
      style={StyleSheet.absoluteFill}
      onPress={onDismiss}
      accessibilityRole="button"
      accessibilityLabel="Close quick actions"
    >
      {opaque ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: color.fanBackdropOpaque }]} />
      ) : (
        <>
          <BlurView intensity={FAN_BLUR_INTENSITY} tint={name} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: color.fanScrim }]} />
        </>
      )}
    </Pressable>
  );
}

function FanItem({
  action,
  index,
  progress,
  enabled,
  onPress,
}: {
  action: FanAction;
  index: number;
  progress: SharedValue<number>;
  enabled: boolean;
  onPress: () => void;
}) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const Icon = ICON[action];
  // Each circle starts on the plus and rises into its slot (Send travels furthest and leads).
  const travel = (LAST - index) * FAN.spacing;
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    if (reduce) return { opacity: p };
    const scale = FAN_ITEM_FROM_SCALE + (1 - FAN_ITEM_FROM_SCALE) * Math.min(p, 1);
    return {
      opacity: Math.min(1, Math.max(0, p)),
      transform: [{ translateY: (1 - p) * travel }, { scale }],
    };
  });
  return (
    <Animated.View style={[styles.item, style]}>
      <Pressable
        disabled={!enabled}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={FAN_LABEL[action]}
        style={({ pressed }) => [styles.itemHit, pressed ? styles.pressed : null]}
      >
        {({ pressed }) => (
          <>
            <Text style={[TYPE.fanLabel, { color: color.fanLabel }]} numberOfLines={1}>
              {FAN_LABEL[action]}
            </Text>
            <View style={[styles.circle, { backgroundColor: pressed ? color.fanCirclePressed : color.fanCircle }]}>
              <Icon size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.fanText} />
            </View>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

const PRESSED_SCALE = 0.96;

const styles = StyleSheet.create({
  trigger: { position: "absolute", width: FAN.trigger, height: FAN.trigger, borderRadius: RADIUS.pill },
  hit: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center" },
  disc: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: RADIUS.pill },
  rim: { borderWidth: HAIRLINE_PX },
  // Centred on the plus: the circles are narrower than the trigger disc.
  column: { position: "absolute", right: FAN.triggerRight + (FAN.trigger - FAN.circle) / 2, alignItems: "flex-end" },
  item: { height: FAN.spacing, justifyContent: "center" },
  itemHit: { flexDirection: "row", alignItems: "center", gap: FAN.labelGap, minHeight: SIZE.touch },
  pressed: { transform: [{ scale: PRESSED_SCALE }] },
  circle: {
    width: FAN.circle,
    height: FAN.circle,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
