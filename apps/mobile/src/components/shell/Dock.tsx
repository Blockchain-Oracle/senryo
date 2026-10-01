import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { TabTrigger, type TabTriggerSlotProps, useTabTrigger } from "expo-router/ui";
import { ChartCandlestick, CircleUserRound, CreditCard, House, type LucideIcon, UsersRound } from "lucide-react-native";
import { forwardRef, useEffect, useRef } from "react";
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { DOCK, dockBottom, EASE, ELEVATION, FAN, HAIRLINE_PX, RADIUS, SIZE, SPRING, TIMING, useTheme } from "~/theme";
import { DOCK_BLUR_INTENSITY, DOCK_PRESS_SCALE, TAB_LABEL, TABS, type TabName } from "./constants";
import { useDock } from "./dock-context";
import { useReduceTransparency } from "./useReduceTransparency";

/**
 * The C15 floating dock (Fomo F12/F16, M10; Codex consult 1 Oct): an icon-only glass capsule, 56 pt high and 28 pt
 * from the left edge, sitting low in the home-indicator band, with the plus (Phantom P12) beside it on the same row. The active destination sits in a lighter
 * bubble that travels on a spring with a small overshoot and stretches while it moves; the arriving icon pops.
 * Material: Liquid Glass on iOS 26 (expo-glass-effect), blur + tint elsewhere, opaque under Reduce Transparency.
 * Destinations keep their names for VoiceOver; nothing is labelled on screen (the reference dock has no labels).
 * Slides out while a transaction is entered. Lucide identifies the destinations (actions), never entities.
 */
const ICON: Record<TabName, LucideIcon> = {
  home: House,
  markets: ChartCandlestick,
  card: CreditCard,
  social: UsersRound,
  you: CircleUserRound,
};
const GLASS = Platform.OS === "ios" && isLiquidGlassAvailable();

function DockMaterial() {
  const { color, name } = useTheme();
  if (useReduceTransparency()) {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: color.glassOpaque }]} />;
  }
  if (GLASS) {
    return (
      <GlassView
        style={StyleSheet.absoluteFill}
        glassEffectStyle="regular"
        tintColor={color.glassTint}
        colorScheme={name}
      />
    );
  }
  return (
    <BlurView intensity={DOCK_BLUR_INTENSITY} tint={name} style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: color.glassTint }]} />
    </BlurView>
  );
}

type DockButtonProps = TabTriggerSlotProps & { tab: TabName };

const DockButton = forwardRef<View, DockButtonProps>(function DockButton({ tab, isFocused, onPress, ...props }, ref) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const press = usePressScale(DOCK_PRESS_SCALE);
  const pop = useSharedValue(1);
  const wasFocused = useRef(isFocused);
  useEffect(() => {
    if (isFocused && !wasFocused.current && !reduce) {
      pop.value = withSequence(
        withTiming(DOCK.iconPop, { duration: TIMING.press, easing: EASE }),
        withSpring(1, SPRING.dockBubble),
      );
    }
    wasFocused.current = isFocused;
  }, [isFocused, pop, reduce]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const Icon = ICON[tab];
  return (
    <Pressable
      ref={ref}
      {...props}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onPress={(e) => {
        if (!isFocused) fire("tick");
        onPress?.(e);
      }}
      accessibilityRole="tab"
      accessibilityLabel={TAB_LABEL[tab]}
      accessibilityState={{ selected: Boolean(isFocused) }}
      style={styles.button}
    >
      <Animated.View style={press.style}>
        <Animated.View style={popStyle}>
          <Icon
            size={DOCK.iconSize}
            strokeWidth={isFocused ? DOCK.iconStrokeActive : DOCK.iconStroke}
            color={isFocused ? color.ink : color.text3}
          />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
});

/** The focused destination, by route name (D-193: the router's route order need not follow the dock's order). */
export function useFocusedTab(): TabName {
  const { getTrigger } = useTabTrigger({ name: TABS[0] });
  return TABS.find((tab) => getTrigger(tab)?.isFocused) ?? TABS[0];
}

/** The dock: triggers outside `TabList` (the hidden list in `(tabs)/_layout.tsx` defines the routes). */
export function Dock() {
  const { color } = useTheme();
  const { hidden } = useDock();
  const reduce = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const focused = Math.max(0, TABS.indexOf(useFocusedTab()));
  const itemWidth = (width - 2 * DOCK.inset - FAN.trigger - DOCK.plusGap - 2 * DOCK.padding) / TABS.length;
  const bottom = dockBottom(insets.bottom);
  const x = useSharedValue(focused * itemWidth);
  const stretch = useSharedValue(1);
  const drop = DOCK.height + bottom;
  const y = useSharedValue(hidden ? drop : 0);
  useEffect(() => {
    const to = focused * itemWidth;
    if (reduce) {
      x.value = withTiming(to, { duration: TIMING.reducedMotion });
      return;
    }
    if (x.value !== to) {
      stretch.value = withSequence(
        withTiming(DOCK.bubbleStretch, { duration: TIMING.press, easing: EASE }),
        withSpring(1, SPRING.dockBubble),
      );
    }
    x.value = withSpring(to, SPRING.dockBubble);
  }, [focused, itemWidth, x, stretch, reduce]);
  useEffect(() => {
    y.value = withTiming(hidden ? drop : 0, { duration: reduce ? TIMING.reducedMotion : TIMING.selection });
  }, [hidden, drop, y, reduce]);
  const bubble = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { scaleX: stretch.value }] }));
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View
      pointerEvents={hidden ? "none" : "box-none"}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
      accessibilityRole="tablist"
      style={[styles.shadowed, ELEVATION.dock, { bottom }, lift]}
    >
      <View style={[styles.dock, GLASS ? null : { borderWidth: HAIRLINE_PX, borderColor: color.glassRim }]}>
        <DockMaterial />
        <Animated.View
          style={[
            styles.bubble,
            {
              width: itemWidth - 2 * DOCK.bubbleGap,
              backgroundColor: color.glassBubble,
              boxShadow: `inset 0px ${HAIRLINE_PX}px 0px 0px ${color.glassBubbleRim}`,
            },
            bubble,
          ]}
        />
        {TABS.map((tab) => (
          <TabTrigger key={tab} name={tab} asChild>
            <DockButton tab={tab} />
          </TabTrigger>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadowed: {
    position: "absolute",
    left: DOCK.inset,
    right: DOCK.inset + FAN.trigger + DOCK.plusGap,
    height: DOCK.height,
    borderRadius: RADIUS.pill,
  },
  dock: {
    flex: 1,
    borderRadius: RADIUS.pill,
    overflow: "hidden",
    flexDirection: "row",
    paddingHorizontal: DOCK.padding,
  },
  bubble: {
    position: "absolute",
    top: DOCK.bubbleInset,
    bottom: DOCK.bubbleInset,
    left: DOCK.padding + DOCK.bubbleGap,
    borderRadius: RADIUS.pill,
  },
  button: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: SIZE.touch },
});
