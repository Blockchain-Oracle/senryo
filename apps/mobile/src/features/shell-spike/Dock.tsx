import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { TabTrigger, type TabTriggerSlotProps } from "expo-router/ui";
import { ChartCandlestick, CircleUserRound, CreditCard, House, type LucideIcon, UsersRound } from "lucide-react-native";
import { forwardRef, useEffect, useState } from "react";
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DOCK, ELEVATION, HAIRLINE_PX, RADIUS, SIZE, SPACE, SPRING, TIMING, TYPE, useTheme } from "~/theme";
import { useDock } from "./dock-context";
import { SPIKE_ROOT, SPIKE_TABS, type SpikeTab } from "./screens";

/**
 * S1b.7 navigation spike (D-193): the C15 floating dock on `expo-router/ui` headless tabs. A ~64 pt pill 16 pt from the
 * edges and 12 pt above the safe area, visible labels, a moving active region (spring 1/500/36, M10), Liquid Glass on
 * iOS 26 (expo-glass-effect), blur + glass tint elsewhere (expo-blur), opaque under Reduce Transparency. Hidden while a
 * transaction is entered. Lucide icons identify the destinations (actions), never entities.
 */
const ICON: Record<SpikeTab, LucideIcon> = {
  home: House,
  markets: ChartCandlestick,
  card: CreditCard,
  social: UsersRound,
  you: CircleUserRound,
};
const LABEL: Record<SpikeTab, string> = {
  home: "Home",
  markets: "Markets",
  card: "Card",
  social: "Social",
  you: "You",
};
/** Spike-only fallback blur strength (expo-blur 0–100); the real value is set when C15 is built (S1b.7). */
const FALLBACK_BLUR_INTENSITY = 60;
const GLASS = Platform.OS === "ios" && isLiquidGlassAvailable();

export function triggerHref(tab: SpikeTab) {
  return `${SPIKE_ROOT}/${tab}` as const;
}

function useReduceTransparency(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener("reduceTransparencyChanged", setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

function DockMaterial() {
  const { color, name } = useTheme();
  if (useReduceTransparency())
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: color.glassOpaque }]} />;
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
    <BlurView intensity={FALLBACK_BLUR_INTENSITY} tint={name} style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: color.glassTint }]} />
    </BlurView>
  );
}

type DockButtonProps = TabTriggerSlotProps & { tab: SpikeTab };

const DockButton = forwardRef<View, DockButtonProps>(function DockButton({ tab, isFocused, ...props }, ref) {
  const { color } = useTheme();
  const Icon = ICON[tab];
  const ink = isFocused ? color.ink : color.text3;
  return (
    <Pressable
      ref={ref}
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={LABEL[tab]}
      accessibilityState={{ selected: Boolean(isFocused) }}
      style={styles.button}
    >
      <Icon size={DOCK.iconSize} strokeWidth={SIZE.iconStroke} color={ink} />
      <Text style={[TYPE.tabLabel, { color: ink }]}>{LABEL[tab]}</Text>
    </Pressable>
  );
});

/** The dock: triggers outside `TabList` (the hidden list in the layout defines the routes). */
export function Dock({ focused }: { focused: number }) {
  const { color } = useTheme();
  const { hidden } = useDock();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const itemWidth = (width - 2 * DOCK.inset) / SPIKE_TABS.length;
  const x = useSharedValue(focused * itemWidth);
  const drop = DOCK.height + DOCK.bottomOffset + insets.bottom;
  const y = useSharedValue(hidden ? drop : 0);
  useEffect(() => {
    x.value = withSpring(focused * itemWidth, SPRING.dockActive);
  }, [focused, itemWidth, x]);
  useEffect(() => {
    y.value = withTiming(hidden ? drop : 0, { duration: TIMING.selection });
  }, [hidden, drop, y]);
  const region = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View
      pointerEvents={hidden ? "none" : "auto"}
      accessibilityElementsHidden={hidden}
      style={[
        styles.dock,
        ELEVATION.dock,
        { bottom: insets.bottom + DOCK.bottomOffset, borderColor: color.glassRim },
        lift,
      ]}
    >
      <DockMaterial />
      <Animated.View style={[styles.region, { width: itemWidth, backgroundColor: color.selectedRow }, region]} />
      {SPIKE_TABS.map((tab) => (
        <TabTrigger key={tab} name={tab} asChild>
          <DockButton tab={tab} />
        </TabTrigger>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: "absolute",
    left: DOCK.inset,
    right: DOCK.inset,
    height: DOCK.height,
    borderRadius: RADIUS.pill,
    borderWidth: HAIRLINE_PX,
    overflow: "hidden",
    flexDirection: "row",
  },
  region: { position: "absolute", top: SPACE.xs, bottom: SPACE.xs, borderRadius: RADIUS.pill },
  button: { flex: 1, alignItems: "center", justifyContent: "center", gap: DOCK.labelGap },
});
