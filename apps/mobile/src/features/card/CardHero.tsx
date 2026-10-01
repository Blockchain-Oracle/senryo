/**
 * The Kinpaku card as the tab's hero (Solflare S18 adapted, Senryo's own art): the card face, tilted a little, settles
 * into place when the tab first appears, and a soft band of light crosses the gold leaf once every ambient loop — the
 * leaf catching light, not a wobble. Transform and opacity only. Reduce Motion: the card is simply there, still.
 */
import { type ReactNode, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
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
import { RADIUS, SPRING, TIMING, useTheme } from "~/theme";

/** The card rests at this tilt (deg) and arrives from a steeper one, a little lower. */
const REST_TILT = -3;
const FROM_TILT = -9;
const FROM_RISE = 24;
/** The light band is this wide (share of the card) and takes this long to cross; it waits the rest of the loop. */
const BAND_SHARE = 0.45;
const SWEEP_MS = 1_600;
const BAND_PEAK = 0.22;

export function CardHero({ children }: { children: ReactNode }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(0);
  const settle = useSharedValue(reduce ? 1 : 0);
  const sweep = useSharedValue(0);
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
  const card = useAnimatedStyle(() => ({
    opacity: Math.min(1, settle.value * 2),
    transform: [
      { translateY: (1 - settle.value) * FROM_RISE },
      { rotate: `${FROM_TILT + (REST_TILT - FROM_TILT) * settle.value}deg` },
    ],
  }));
  const band = width * BAND_SHARE;
  const light = useAnimatedStyle(() => ({
    opacity: sweep.value > 0 && sweep.value < 1 ? 1 : 0,
    transform: [{ translateX: -band + sweep.value * (width + band) }],
  }));
  return (
    <Animated.View style={card} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.clip}>
        {children}
        {reduce || width === 0 ? null : (
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
  );
}

const styles = StyleSheet.create({
  clip: { borderRadius: RADIUS.lg, overflow: "hidden" },
  band: { position: "absolute", top: 0, bottom: 0, left: 0 },
});
