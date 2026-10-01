import { X } from "lucide-react-native";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef } from "react";
import { BackHandler, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { EASE, ELEVATION, RADIUS, SIZE, SPACE, SPRING, TIMING, useTheme } from "~/theme";
import { SHEET } from "./constants";

const CloseContext = createContext<(after?: () => void) => void>(() => undefined);

/** Closes the transaction sheet from inside it (the same slide-down as a drag), then runs `after`. */
export function useTransactionClose(): (after?: () => void) => void {
  return useContext(CloseContext);
}

/**
 * The full-height transaction sheet (sheet grammar §5.5, C39/M13; Codex S1b.7 consult #1 — an in-house Reanimated
 * reconstruction, Gorhom deferred to J2): an opaque panel that rises over its dimmed parent on the tall-detail spring
 * (1/240/30, M07/M08/M13) to just below the status bar, with a handle and fixed identity / entry / action zones laid
 * out by its children. Only the handle and identity zone drag (the keypad and the ruler keep their gestures); a drag past a
 * quarter of the height or a flick dismisses, as do the visible close button beside the handle (review R06: the sheet
 * is nearly full height, so the scrim and the drag are not discoverable enough on their own), the scrim, Android back
 * and `useTransactionClose`. Reduce Motion: a ~100 ms crossfade. `locked` holds it open while a transaction is in
 * flight (the trace stays attached): the close button, drag, scrim and back are off, and the content offers its own
 * explicit "leave" that says what leaving does and doesn't do.
 */
export function TransactionSheet({
  onClose,
  closeLabel,
  locked = false,
  header,
  children,
}: {
  onClose: () => void;
  closeLabel: string;
  locked?: boolean;
  /** The fixed identity zone; it drags with the handle. */
  header?: ReactNode;
  children: ReactNode;
}) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: window } = useWindowDimensions();
  const reduce = useReducedMotion();
  const top = insets.top + SPACE.sm;
  const height = window - top;
  const drag = useSharedValue(reduce ? 0 : height);
  const scrim = useSharedValue(0);
  const closing = useRef(false);

  useEffect(() => {
    scrim.value = withTiming(1, { duration: reduce ? TIMING.reducedMotion : TIMING.tallDetail, easing: EASE });
    if (!reduce) drag.value = withSpring(0, SPRING.tallDetail);
  }, [drag, scrim, reduce]);

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
      const out = { duration: reduce ? TIMING.reducedMotion : TIMING.pagePush, easing: EASE };
      scrim.value = withTiming(0, out);
      drag.value = withTiming(reduce ? 0 : height, out, (done) => {
        if (done) scheduleOnRN(finish, after);
      });
    },
    [drag, finish, height, reduce, scrim],
  );

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!locked) close();
      return true;
    });
    return () => sub.remove();
  }, [close, locked]);

  const pan = Gesture.Pan()
    .enabled(!locked)
    .activeOffsetY(SHEET.activeOffsetY)
    .onUpdate((e) => {
      drag.value = e.translationY > 0 ? e.translationY : e.translationY / SHEET.upwardResistance;
    })
    .onEnd((e) => {
      if (drag.value > height * SHEET.closeFraction || e.velocityY > SHEET.closeVelocity) scheduleOnRN(close);
      else drag.value = withSpring(0, SPRING.tallDetail);
    });

  const panel = useAnimatedStyle(() => ({
    opacity: reduce ? scrim.value : 1,
    transform: [{ translateY: drag.value }],
  }));
  const dim = useAnimatedStyle(() => ({ opacity: scrim.value }));

  return (
    <View style={styles.root}>
      <CloseContext.Provider value={close}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: color.scrim }, dim]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            disabled={locked}
            onPress={() => close()}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
          />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          onAccessibilityEscape={() => {
            if (!locked) close();
          }}
          style={[
            styles.panel,
            ELEVATION.sheet,
            { top, backgroundColor: color.popover, paddingBottom: insets.bottom },
            panel,
          ]}
        >
          <GestureDetector gesture={pan}>
            <View>
              <View style={styles.handleZone}>
                {locked ? (
                  <View style={styles.close} />
                ) : (
                  <Pressable
                    onPress={() => close()}
                    accessibilityRole="button"
                    accessibilityLabel={closeLabel}
                    hitSlop={SPACE.xs}
                    style={styles.close}
                  >
                    <X size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.text2} />
                  </Pressable>
                )}
                <View
                  style={styles.handleSlot}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <View style={[styles.handle, { backgroundColor: color.sheetHandle }]} />
                </View>
                <View style={styles.close} />
              </View>
              {header}
            </View>
          </GestureDetector>
          {children}
        </Animated.View>
      </CloseContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    overflow: "hidden",
  },
  handleZone: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.sm },
  handleSlot: { flex: 1, alignItems: "center" },
  close: { width: SIZE.touch, height: SIZE.touch, alignItems: "center", justifyContent: "center" },
  handle: { width: SIZE.handleWidth, height: SIZE.handleHeight, borderRadius: RADIUS.pill },
});
