import { ChevronLeft } from "lucide-react-native";
import { type ReactNode, useEffect, useState } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { fire } from "~/feedback/fire";
import { EASE, ELEVATION, RADIUS, SIZE, SPACE, SPRING, TIMING, TYPE, useTheme } from "~/theme";

/**
 * A nested child over a transaction sheet (sheet grammar §5.5: "nested child — explicit back, keyboard-aware"; C42,
 * F43–F45, M15): the parent stays mounted and dimmed behind it with every value kept (FT112), the child rises on the
 * compact-selector spring (1/260/30) to its content height and lifts with the native keyboard. Back, the scrim and
 * Android back all close it; Reduce Motion crossfades. Render it inside the screen that owns the parent sheet.
 */
export function ChildSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const keyboard = useAnimatedKeyboard();
  const [mounted, setMounted] = useState(open);
  const progress = useSharedValue(0);
  const height = useSharedValue(0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      progress.value = reduce
        ? withTiming(1, { duration: TIMING.reducedMotion })
        : withSpring(1, SPRING.compactSelector);
      return;
    }
    progress.value = withTiming(
      0,
      { duration: reduce ? TIMING.reducedMotion : TIMING.selection, easing: EASE },
      (done) => {
        if (done) scheduleOnRN(setMounted, false);
      },
    );
  }, [open, progress, reduce]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [open, onClose]);

  const dim = useAnimatedStyle(() => ({ opacity: progress.value }));
  const panel = useAnimatedStyle(() => ({
    opacity: reduce ? progress.value : 1,
    transform: [
      { translateY: (reduce ? 0 : (1 - progress.value) * (height.value + insets.bottom)) - keyboard.height.value },
    ],
  }));
  const pad = useAnimatedStyle(() => ({
    paddingBottom: Math.max(SPACE.lg, insets.bottom + SPACE.sm - keyboard.height.value),
  }));

  if (!mounted) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? "auto" : "none"}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: color.scrim }, dim]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={`Close ${title}`}
        />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
        onLayout={(e) => {
          height.value = e.nativeEvent.layout.height;
        }}
        style={[styles.panel, ELEVATION.sheet, { backgroundColor: color.popover }, panel]}
      >
        <View style={styles.handleZone} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[styles.handle, { backgroundColor: color.sheetHandle }]} />
        </View>
        <View style={styles.head}>
          <Pressable
            onPress={() => {
              fire("tick");
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={SPACE.sm}
            style={styles.back}
          >
            <ChevronLeft size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.ink} />
          </Pressable>
          <View style={styles.titles}>
            <Text accessibilityRole="header" style={[TYPE.sectionTitle, styles.center, { color: color.ink }]}>
              {title}
            </Text>
            {subtitle ? <Text style={[TYPE.meta, styles.center, { color: color.text2 }]}>{subtitle}</Text> : null}
          </View>
          <View style={styles.back} />
        </View>
        <Animated.View style={[styles.body, pad]}>{children}</Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
  },
  handleZone: { alignItems: "center", paddingTop: SPACE.sm, paddingBottom: SPACE.xs },
  handle: { width: SIZE.handleWidth, height: SIZE.handleHeight, borderRadius: RADIUS.pill },
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.md, gap: SPACE.sm },
  back: { width: SIZE.touch, height: SIZE.touch, alignItems: "center", justifyContent: "center" },
  titles: { flex: 1, gap: SPACE.xxs },
  center: { textAlign: "center" },
  body: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.md, gap: SPACE.md },
});
