import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef } from "react";
import { BackHandler, type LayoutChangeEvent, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector, ScrollView } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedKeyboard,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fire } from "~/feedback/fire";
import { DURATION, EASE, HAIRLINE_PX, RADIUS, SIZE, SPACE, SPRING, useTheme } from "~/theme";
import { SHEET } from "./constants";

const OUT = { duration: DURATION.slow, easing: EASE };
const DrawerScroll = Animated.createAnimatedComponent(ScrollView);
const SheetContext = createContext<(after?: () => void) => void>(() => undefined);

/** Closes the sheet from inside it — the same slide-down as a drag — then runs `after` (a navigation, say). */
export function useSheetClose(): (after?: () => void) => void {
  return useContext(SheetContext);
}

interface SheetProps {
  /** Called once the sheet has slid away (drag, scrim, back button or `useSheetClose`). */
  onClose: () => void;
  children: ReactNode;
  /** The scrim's accessible name ("Close add money"). */
  closeLabel: string;
  /** Tallest the panel grows before its content scrolls, as a fraction of the window. */
  maxHeight?: number;
}

/**
 * The app's compact selector (ported BottomDrawer; sheet grammar §5.5): a dimming scrim that fades in — no blur: only
 * the fan blurs (direction §3, S1b.7) — and a content-sized panel with 24 pt top corners that springs up on the
 * compact-selector spring (1/260/30, M02), drag-down to dismiss past 25 % of its height or
 * 900 pt/s that hands over to the content's own scroll, the safe area under it, and the keyboard pushing it up.
 * Reduce Motion swaps the spring for a fade. Rendered by a transparent-modal route.
 */
export function Sheet({ onClose, children, closeLabel, maxHeight = SHEET.maxHeight }: SheetProps) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduce = useReducedMotion();
  const keyboard = useAnimatedKeyboard();
  const height = useSharedValue(windowHeight);
  const drag = useSharedValue(windowHeight);
  const scrim = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const opened = useRef(false);
  const closing = useRef(false);

  const finish = useCallback(
    (after?: () => void) => {
      onClose();
      after?.();
    },
    [onClose],
  );

  const close = useCallback(
    (after?: () => void) => {
      if (closing.current) return;
      closing.current = true;
      scrim.value = withTiming(0, OUT);
      drag.value = withTiming(reduce ? drag.value : height.value + insets.bottom, OUT, (done) => {
        if (done) runOnJS(finish)(after);
      });
    },
    [drag, finish, height, insets.bottom, reduce, scrim],
  );

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  const onLayout = (e: LayoutChangeEvent) => {
    height.value = e.nativeEvent.layout.height;
    if (opened.current) return;
    opened.current = true;
    fire("snap");
    scrim.value = withTiming(1, { duration: DURATION.slow, easing: EASE });
    if (reduce) drag.value = 0;
    else {
      drag.value = e.nativeEvent.layout.height;
      drag.value = withSpring(0, SPRING.compactSelector);
    }
  };

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const native = Gesture.Native();
  const pan = Gesture.Pan()
    .activeOffsetY(SHEET.activeOffsetY)
    .failOffsetX([-SHEET.failOffsetX, SHEET.failOffsetX])
    .simultaneousWithExternalGesture(native)
    .onUpdate((e) => {
      if (scrollY.value > 0) return;
      drag.value = e.translationY > 0 ? e.translationY : e.translationY / SHEET.upwardResistance;
    })
    .onEnd((e) => {
      if (scrollY.value > 0 && drag.value <= 0) return;
      if (drag.value > height.value * SHEET.closeFraction || e.velocityY > SHEET.closeVelocity) runOnJS(close)();
      else drag.value = withSpring(0, SPRING.compactSelector);
    });

  const panelStyle = useAnimatedStyle(() => ({
    opacity: reduce ? scrim.value : 1,
    transform: [{ translateY: drag.value - keyboard.height.value }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));
  const keyboardPad = useAnimatedStyle(() => ({
    paddingBottom: Math.max(SPACE.lg, insets.bottom - keyboard.height.value),
  }));

  return (
    <View style={styles.root}>
      <SheetContext.Provider value={close}>
        <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: color.scrim }]}
            onPress={() => close()}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
          />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View
            onLayout={onLayout}
            accessibilityViewIsModal
            style={[
              styles.panel,
              { maxHeight: windowHeight * maxHeight, backgroundColor: color.popover, borderColor: color.hairline },
              panelStyle,
            ]}
          >
            <View style={styles.handleZone} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={[styles.handle, { backgroundColor: color.border }]} />
            </View>
            <GestureDetector gesture={native}>
              <DrawerScroll
                onScroll={onScroll}
                scrollEventThrottle={SHEET.scrollThrottle}
                bounces={false}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Animated.View style={[styles.content, keyboardPad]}>{children}</Animated.View>
              </DrawerScroll>
            </GestureDetector>
          </Animated.View>
        </GestureDetector>
      </SheetContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  panel: {
    width: "100%",
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    borderWidth: HAIRLINE_PX,
    borderBottomWidth: 0,
    overflow: "hidden",
  },
  handleZone: { alignItems: "center", paddingTop: SPACE.sm, paddingBottom: SPACE.xs },
  handle: { width: SIZE.handleWidth, height: SIZE.handleHeight, borderRadius: RADIUS.pill },
  content: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.sm, gap: SPACE.lg },
});
