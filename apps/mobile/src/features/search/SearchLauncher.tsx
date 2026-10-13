/**
 * Home's floating search (R6.9, UGLYCASH U10 S01, Codex direction 13): a white capsule — "Search for anything" — held
 * still above the dock (the capsule exception), black text in both themes, no shadow at rest. A press shrinks it and
 * a magenta halo blooms only for the entry, then search pushes. It steps aside with the dock when a sheet takes over.
 */
import { type Href, router } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { useDock } from "~/components/shell/dock-context";
import { fire } from "~/feedback/fire";
import { DOCK, dockBottom, SPACE, TIMING, TYPE, useTheme } from "~/theme";

export const LAUNCHER = { width: 264, height: 44, gap: SPACE.lg } as const;
const ICON = 20;
const HALO = 18;
const HALO_PEAK = 0.24;

/** The scroll content's bottom clearance on a page that carries the launcher (its top plus 20 pt). */
export function useLauncherInset(): number {
  const insets = useSafeAreaInsets();
  return dockBottom(insets.bottom) + DOCK.height + LAUNCHER.gap + LAUNCHER.height + SPACE.lgPlus;
}

export function SearchLauncher() {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const { hidden } = useDock();
  const press = usePressScale();
  const halo = useSharedValue(0);
  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.value }));
  if (hidden) return null;
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: dockBottom(insets.bottom) + DOCK.height + LAUNCHER.gap }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.halo, { boxShadow: `0 0 ${HALO}px ${HALO / 2}px ${color.accent}` }, haloStyle]}
      />
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("press", { cue: "sheetOpen" });
          halo.value = withSequence(
            withTiming(HALO_PEAK, { duration: TIMING.press }),
            withTiming(0, { duration: TIMING.selection }),
          );
          router.push("/search" as Href);
        }}
        accessibilityRole="search"
        accessibilityLabel="Search for anything"
      >
        <Animated.View style={[styles.pill, { backgroundColor: color.paper }, press.style]}>
          <Search size={ICON} color={color.paperInk} />
          <Text style={[TYPE.body, { color: color.paperInk }]}>Search for anything</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  halo: {
    position: "absolute",
    width: LAUNCHER.width,
    height: LAUNCHER.height,
    borderRadius: LAUNCHER.height / 2,
  },
  pill: {
    width: LAUNCHER.width,
    height: LAUNCHER.height,
    borderRadius: LAUNCHER.height / 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.md,
  },
});
