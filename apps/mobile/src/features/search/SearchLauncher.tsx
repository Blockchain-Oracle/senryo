/**
 * Home's floating search (R6.9, UGLYCASH U10 S01; the owner's review 13 Oct): a capsule held above the dock in the
 * dock's own material — white in light, the dock's glass in dark, never a white slab on a dark page. Reading down
 * tucks it behind the dock; scrolling up brings it back (`useLauncherScroll`). At rest its words walk through what
 * search can do right now. A press shrinks it, a magenta halo blooms for the entry, and search pushes.
 */
import { type Href, router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Animated, {
  FadeInDown,
  FadeOutUp,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { useDock } from "~/components/shell/dock-context";
import { fire } from "~/feedback/fire";
import { DOCK, dockBottom, ELEVATION, SPACE, TIMING, TYPE, useTheme } from "~/theme";
import { BASE_HINT, useLauncherHint } from "./useLauncher";

export const LAUNCHER = { width: 264, height: 44, gap: SPACE.lg } as const;
const ICON = 20;
const HALO = 18;
const HALO_PEAK = 0.24;
/** Tucked: it sinks this far toward the dock as it fades. */
const TUCK = LAUNCHER.height;
const TUCK_SCALE = 0.9;
const HALF = 0.5;

/** The scroll content's bottom clearance on a page that carries the launcher (its top plus 20 pt). */
export function useLauncherInset(): number {
  const insets = useSafeAreaInsets();
  return dockBottom(insets.bottom) + DOCK.height + LAUNCHER.gap + LAUNCHER.height + SPACE.lgPlus;
}

export function SearchLauncher({ shown }: { shown: SharedValue<number> }) {
  const { name, color } = useTheme();
  const insets = useSafeAreaInsets();
  const { hidden } = useDock();
  const press = usePressScale();
  const halo = useSharedValue(0);
  const [interactive, setInteractive] = useState(true);
  useAnimatedReaction(
    () => shown.value > HALF,
    (now, before) => {
      if (now !== before) runOnJS(setInteractive)(now);
    },
  );
  const hint = useLauncherHint(interactive && !hidden);
  const tuck = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * TUCK }, { scale: TUCK_SCALE + (1 - TUCK_SCALE) * shown.value }],
  }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.value }));
  if (hidden) return null;
  const dark = name === "dark";
  return (
    <Animated.View
      pointerEvents={interactive ? "box-none" : "none"}
      accessibilityElementsHidden={!interactive}
      style={[styles.wrap, { bottom: dockBottom(insets.bottom) + DOCK.height + LAUNCHER.gap }, tuck]}
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
        accessibilityLabel={BASE_HINT}
      >
        <Animated.View
          style={[styles.pill, ELEVATION.dock, { backgroundColor: dark ? color.glassOpaque : color.card }, press.style]}
        >
          <Search size={ICON} color={dark ? color.inkMuted : color.ink} />
          <Animated.View key={hint} entering={FadeInDown} exiting={FadeOutUp} style={styles.hint}>
            <Text numberOfLines={1} style={[TYPE.body, { color: color.ink }]}>
              {hint}
            </Text>
          </Animated.View>
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
    gap: SPACE.md,
    paddingHorizontal: SPACE.lg,
    overflow: "hidden",
  },
  hint: { flex: 1 },
});
