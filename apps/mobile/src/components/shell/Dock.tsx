import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { TabTrigger, type TabTriggerSlotProps, useTabTrigger } from "expo-router/ui";
import { ChartCandlestick, CircleUserRound, CreditCard, House, type LucideIcon, UsersRound } from "lucide-react-native";
import { forwardRef, useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fire } from "~/feedback/fire";
import { DOCK, ELEVATION, HAIRLINE_PX, RADIUS, SIZE, SPRING, TIMING, TYPE, useTheme } from "~/theme";
import { DOCK_BLUR_INTENSITY, DOCK_REGION_INSET, TAB_LABEL, TABS, type TabName } from "./constants";
import { useDock } from "./dock-context";
import { useReduceTransparency } from "./useReduceTransparency";

/**
 * The C15 floating dock (S1b.7, D-176; spike D-193): a ~64 pt capsule 16 pt from the edges and 12 pt above the bottom
 * safe area, five destinations with visible labels, a moving active region (spring 1/500/36, M10). Material: Liquid
 * Glass on iOS 26 (expo-glass-effect), blur + glass tint elsewhere (expo-blur), opaque under Reduce Transparency.
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
  const Icon = ICON[tab];
  const ink = isFocused ? color.ink : color.text3;
  return (
    <Pressable
      ref={ref}
      {...props}
      onPress={(e) => {
        if (!isFocused) fire("tick");
        onPress?.(e);
      }}
      accessibilityRole="tab"
      accessibilityLabel={TAB_LABEL[tab]}
      accessibilityState={{ selected: Boolean(isFocused) }}
      style={styles.button}
    >
      <Icon size={DOCK.iconSize} strokeWidth={SIZE.iconStroke} color={ink} />
      <Text style={[TYPE.tabLabel, { color: ink }]} numberOfLines={1}>
        {TAB_LABEL[tab]}
      </Text>
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
  const itemWidth = (width - 2 * DOCK.inset) / TABS.length;
  const x = useSharedValue(focused * itemWidth);
  const drop = DOCK.height + DOCK.bottomOffset + insets.bottom;
  const y = useSharedValue(hidden ? drop : 0);
  useEffect(() => {
    x.value = reduce
      ? withTiming(focused * itemWidth, { duration: TIMING.reducedMotion })
      : withSpring(focused * itemWidth, SPRING.dockActive);
  }, [focused, itemWidth, x, reduce]);
  useEffect(() => {
    y.value = withTiming(hidden ? drop : 0, { duration: reduce ? TIMING.reducedMotion : TIMING.selection });
  }, [hidden, drop, y, reduce]);
  const region = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View
      pointerEvents={hidden ? "none" : "box-none"}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
      accessibilityRole="tablist"
      style={[styles.shadowed, ELEVATION.dock, { bottom: insets.bottom + DOCK.bottomOffset }, lift]}
    >
      <View style={[styles.dock, { borderColor: color.glassRim }]}>
        <DockMaterial />
        <Animated.View
          style={[
            styles.region,
            { width: itemWidth - 2 * DOCK_REGION_INSET, backgroundColor: color.selectedRow },
            region,
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
    right: DOCK.inset,
    height: DOCK.height,
    borderRadius: RADIUS.pill,
  },
  dock: {
    flex: 1,
    borderRadius: RADIUS.pill,
    borderWidth: HAIRLINE_PX,
    overflow: "hidden",
    flexDirection: "row",
  },
  region: {
    position: "absolute",
    top: DOCK_REGION_INSET,
    bottom: DOCK_REGION_INSET,
    left: DOCK_REGION_INSET,
    borderRadius: RADIUS.pill,
  },
  button: { flex: 1, alignItems: "center", justifyContent: "center", gap: DOCK.labelGap, minHeight: SIZE.touch },
});
