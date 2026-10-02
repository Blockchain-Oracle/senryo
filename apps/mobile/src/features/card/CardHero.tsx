/**
 * The Kinpaku card as the tab's hero (Solflare S16/S18 adapted, Senryo's own art). The card settles in when the tab
 * first appears; a soft band of light crosses the gold leaf once every ambient loop. `floating` (the unissued card) adds
 * a slow drift — a gentle sway in depth and a small rise — so the art reads as an object, not a picture. A finger on the
 * card tilts it toward the touch and it springs back on release (behaviour ported from 21st.dev ibelick/tilt, id 1448:
 * pointer position → rotateX / rotateY through springs, perspective 1000). `dim` is the frozen card. Transform and
 * opacity only; Reduce Motion: the card is simply there, still.
 */
import { type ReactNode, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { DISABLED_OPACITY, RADIUS, SPRING, TIMING, useTheme } from "~/theme";

/** The card rests at this tilt (deg) and arrives from a steeper one, a little lower. */
const REST_TILT = -3;
const FROM_TILT = -9;
const FROM_RISE = 24;
/** The light band is this wide (share of the card) and takes this long to cross; it waits the rest of the loop. */
const BAND_SHARE = 0.45;
const SWEEP_MS = 1_600;
const BAND_PEAK = 0.22;
/** Floating: a sway of ± this many degrees in depth and a rise of this many points, over half an ambient loop. */
const FLOAT_SWAY_DEG = 7;
const FLOAT_RISE = 6;
const FLOAT_HALF_MS = TIMING.ambientLoop / 2;
/** Tilt under the finger (21st Tilt's rotationFactor, reversed so the card leans toward the touch). */
const TOUCH_TILT_DEG = 10;
const PERSPECTIVE = 1000;
const HALF = 0.5;
const TOUCH_SPRING = { damping: 18, stiffness: 180, mass: 0.6 } as const;
/** Points of travel before a drag counts as a tilt (sideways) or hands over to the page's scroll (vertical). */
const SCROLL_SLOP = 8;

export function CardHero({
  children,
  floating = false,
  dim = false,
}: {
  children: ReactNode;
  floating?: boolean;
  dim?: boolean;
}) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const settle = useSharedValue(reduce ? 1 : 0);
  const sweep = useSharedValue(0);
  const drift = useSharedValue(0);
  const touchX = useSharedValue(0);
  const touchY = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    settle.value = withSpring(1, SPRING.tallDetail);
    sweep.value = withDelay(
      TIMING.sheetEnter,
      withRepeat(
        withSequence(
          withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.quad) }),
          withDelay(TIMING.ambientLoop - SWEEP_MS, withTiming(0, { duration: 0 })),
        ),
        -1,
      ),
    );
  }, [reduce, settle, sweep]);

  useEffect(() => {
    if (reduce || !floating) {
      drift.value = withTiming(0, { duration: TIMING.selection });
      return;
    }
    const ease = Easing.inOut(Easing.sin);
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: FLOAT_HALF_MS, easing: ease }),
        withTiming(-1, { duration: FLOAT_HALF_MS, easing: ease }),
      ),
      -1,
      true,
    );
  }, [reduce, floating, drift]);

  // The card leans toward the finger as soon as it lands; a vertical move fails the pan, so the page still scrolls.
  const tilt = Gesture.Pan()
    .enabled(!reduce && size.width > 0)
    .activeOffsetX([-SCROLL_SLOP, SCROLL_SLOP])
    .failOffsetY([-SCROLL_SLOP, SCROLL_SLOP])
    .onBegin((e) => {
      touchX.value = withSpring(e.x / size.width - HALF, TOUCH_SPRING);
      touchY.value = withSpring(e.y / size.height - HALF, TOUCH_SPRING);
    })
    .onUpdate((e) => {
      touchX.value = withSpring(Math.min(HALF, Math.max(-HALF, e.x / size.width - HALF)), TOUCH_SPRING);
      touchY.value = withSpring(Math.min(HALF, Math.max(-HALF, e.y / size.height - HALF)), TOUCH_SPRING);
    })
    .onFinalize(() => {
      touchX.value = withSpring(0, TOUCH_SPRING);
      touchY.value = withSpring(0, TOUCH_SPRING);
    });

  const card = useAnimatedStyle(() => ({
    opacity: Math.min(1, settle.value * 2) * (dim ? DISABLED_OPACITY : 1),
    transform: [
      { perspective: PERSPECTIVE },
      { translateY: (1 - settle.value) * FROM_RISE - drift.value * FLOAT_RISE },
      { rotate: `${FROM_TILT + (REST_TILT - FROM_TILT) * settle.value}deg` },
      { rotateY: `${drift.value * FLOAT_SWAY_DEG - touchX.value * 2 * TOUCH_TILT_DEG}deg` },
      { rotateX: `${touchY.value * 2 * TOUCH_TILT_DEG}deg` },
    ],
  }));
  const band = size.width * BAND_SHARE;
  const light = useAnimatedStyle(() => ({
    opacity: sweep.value > 0 && sweep.value < 1 ? 1 : 0,
    transform: [{ translateX: -band + sweep.value * (size.width + band) }],
  }));
  return (
    <GestureDetector gesture={tilt}>
      <Animated.View style={card} onLayout={(e) => setSize(e.nativeEvent.layout)}>
        <View style={styles.clip}>
          {children}
          {reduce || size.width === 0 || dim ? null : (
            <Animated.View pointerEvents="none" style={[styles.band, { width: band }, light]}>
              <Svg width="100%" height="100%">
                <Defs>
                  <LinearGradient id="kinpaku-light" x1="0" y1="0" x2="1" y2="0.2">
                    <Stop offset="0" stopColor={color.onLacquer} stopOpacity={0} />
                    <Stop offset="0.5" stopColor={color.onLacquer} stopOpacity={BAND_PEAK} />
                    <Stop offset="1" stopColor={color.onLacquer} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#kinpaku-light)" />
              </Svg>
            </Animated.View>
          )}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  clip: { borderRadius: RADIUS.lg, overflow: "hidden" },
  band: { position: "absolute", top: 0, bottom: 0, left: 0 },
});
