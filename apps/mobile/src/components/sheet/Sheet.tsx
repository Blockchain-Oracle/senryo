import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef } from "react";
import { BackHandler, type LayoutChangeEvent, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector, ScrollView } from "react-native-gesture-handler";
import Animated, {
  useAnimatedKeyboard,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { SurfaceLevel } from "~/components/kit/Surface";
import { fire } from "~/feedback/fire";
import { EASE, EASE_SHEET, ELEVATION, HAIRLINE_PX, RADIUS, SHEET_SHAPE, SIZE, SPRING, TIMING, useTheme } from "~/theme";
import { SHEET } from "./constants";

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
  /** False while something is in flight that the sheet must stay attached to: no drag, scrim, back or handle. */
  dismissible?: boolean;
}

/** Edge-attached reference sheet: rounded top, live dimmed parent and keyboard-aware scrolling.
 * Existing drag/Back/cancel ownership stays intact; Reduced Motion fades instead of travelling.
 */
export function Sheet({ onClose, children, closeLabel, maxHeight = SHEET.maxHeight, dismissible = true }: SheetProps) {
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
      const out = { duration: reduce ? TIMING.reducedMotion : TIMING.sheetExit, easing: EASE };
      scrim.value = withTiming(0, out);
      drag.value = withTiming(reduce ? drag.value : height.value + SHEET_SHAPE.inset, out, (done) => {
        if (done) scheduleOnRN(finish, after);
      });
    },
    [drag, finish, height, reduce, scrim],
  );

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (dismissible) close();
      return true;
    });
    return () => sub.remove();
  }, [close, dismissible]);

  const onLayout = (e: LayoutChangeEvent) => {
    height.value = e.nativeEvent.layout.height;
    if (opened.current) return;
    opened.current = true;
    fire("snap");
    scrim.value = withTiming(1, { duration: reduce ? TIMING.reducedMotion : TIMING.selection, easing: EASE });
    if (reduce) drag.value = 0;
    else {
      drag.value = e.nativeEvent.layout.height + SHEET_SHAPE.inset;
      drag.value = withTiming(0, { duration: TIMING.sheetEnter, easing: EASE_SHEET });
    }
  };

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const native = Gesture.Native();
  const pan = Gesture.Pan()
    .enabled(dismissible)
    .activeOffsetY(SHEET.activeOffsetY)
    .failOffsetX([-SHEET.failOffsetX, SHEET.failOffsetX])
    .simultaneousWithExternalGesture(native)
    .onUpdate((e) => {
      if (scrollY.value > 0) return;
      drag.value = e.translationY > 0 ? e.translationY : e.translationY / SHEET.upwardResistance;
    })
    .onEnd((e) => {
      if (scrollY.value > 0 && drag.value <= 0) return;
      const past = drag.value > Math.min(SHEET.closeDistance, height.value * SHEET.closeFraction);
      if (past || e.velocityY > SHEET.closeVelocity) scheduleOnRN(close);
      else drag.value = withSpring(0, { ...SPRING.sheetRelease, velocity: e.velocityY });
    });

  const panelStyle = useAnimatedStyle(() => ({
    maxHeight: Math.max(0, Math.min(windowHeight * maxHeight, windowHeight - insets.top - keyboard.height.value)),
    opacity: reduce ? scrim.value : 1,
    transform: [{ translateY: drag.value - keyboard.height.value }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));
  // The panel reaches into the home-indicator band; its content stops above it (and above the keyboard's top edge).
  const keyboardPad = useAnimatedStyle(() => ({
    paddingBottom: Math.max(SHEET_SHAPE.padding, insets.bottom - SHEET_SHAPE.inset - keyboard.height.value),
  }));

  return (
    <View style={styles.root}>
      <SheetContext.Provider value={close}>
        <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: color.scrim }]}
            disabled={!dismissible}
            onPress={() => close()}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
          />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View
            onLayout={onLayout}
            accessibilityViewIsModal
            onAccessibilityEscape={() => {
              if (dismissible) close();
            }}
            style={[styles.panel, ELEVATION.sheet, { backgroundColor: color.popover }, panelStyle]}
          >
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                styles.edge,
                { boxShadow: `inset 0px ${HAIRLINE_PX}px 0px 0px ${color.surfaceRim}` },
              ]}
            />
            <View style={styles.handleZone} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={[styles.handle, { backgroundColor: dismissible ? color.sheetHandle : color.transparent }]} />
            </View>
            <GestureDetector gesture={native}>
              <DrawerScroll
                onScroll={onScroll}
                scrollEventThrottle={SHEET.scrollThrottle}
                bounces={false}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <SurfaceLevel.Provider value={1}>
                  <Animated.View style={[styles.content, keyboardPad]}>{children}</Animated.View>
                </SurfaceLevel.Provider>
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
    marginHorizontal: SHEET_SHAPE.inset,
    marginBottom: SHEET_SHAPE.inset,
    borderTopLeftRadius: SHEET_SHAPE.radius,
    borderTopRightRadius: SHEET_SHAPE.radius,
    overflow: "hidden",
  },
  edge: { borderTopLeftRadius: SHEET_SHAPE.radius, borderTopRightRadius: SHEET_SHAPE.radius },
  handleZone: { alignItems: "center", paddingTop: SHEET_SHAPE.handleTop, paddingBottom: SHEET_SHAPE.handleBottom },
  handle: { width: SIZE.handleWidth, height: SIZE.handleHeight, borderRadius: RADIUS.pill },
  content: { paddingHorizontal: SHEET_SHAPE.padding, gap: SHEET_SHAPE.padding },
});
