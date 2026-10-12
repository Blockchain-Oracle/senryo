/**
 * The slip's stamp on the phone (D-331; the web's `ReceiptStamp`): an 88 pt Kinpaku seal at −4° — a foil ring, the
 * lacquer field, a fine foil rule and the verdict in gold-leaf words. It presses once when a result is seen arriving
 * (scale 1.12 → 0.98 → 1, y −8 → 0 over 220 ms; a fade under Reduce Motion); history and exports show it at rest.
 */
import type { SlipStamp } from "@senryo/calls";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { FONT, KINPAKU, SLIP } from "~/theme";

const FOIL = [KINPAKU.foilHighlight, KINPAKU.foilLight, KINPAKU.foilMid, KINPAKU.foilShade, KINPAKU.foilDeep] as const;
const PRESS_FROM = 1.12;
const PRESS_UNDER = 0.98;
const PRESS_LIFT = -8;
const PRESS_IN_MS = 120;
const PRESS_SETTLE_MS = 100;
const FADE_MS = 100;
const WORD_TRACKING = 0.6;

export function ReceiptStamp({ stamp, press = false }: { stamp: SlipStamp; press?: boolean }) {
  const reduce = useReducedMotion();
  const pressing = press && !reduce;
  const opacity = useSharedValue(press ? 0 : 1);
  const scale = useSharedValue(pressing ? PRESS_FROM : 1);
  const lift = useSharedValue(pressing ? PRESS_LIFT : 0);

  useEffect(() => {
    if (!press) return;
    opacity.value = withTiming(1, { duration: reduce ? FADE_MS : PRESS_IN_MS });
    if (reduce) return;
    scale.value = withSequence(
      withTiming(PRESS_UNDER, { duration: PRESS_IN_MS }),
      withTiming(1, { duration: PRESS_SETTLE_MS }),
    );
    lift.value = withTiming(0, { duration: PRESS_IN_MS });
  }, [press, reduce, opacity, scale, lift]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ rotate: SLIP.stampTilt }, { translateY: lift.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[styles.stamp, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={stamp.lines.join(" ")}
    >
      <Svg style={StyleSheet.absoluteFill} width={SLIP.stamp} height={SLIP.stamp}>
        <Defs>
          <LinearGradient id="slip-foil" x1="0" y1="0" x2="1" y2="1">
            {FOIL.map((c, i) => (
              <Stop key={c} offset={i / (FOIL.length - 1)} stopColor={c} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect width={SLIP.stamp} height={SLIP.stamp} rx={SLIP.stampRadius} fill="url(#slip-foil)" />
      </Svg>
      <View style={styles.field}>
        <View style={styles.words}>
          {stamp.lines.map((line) => (
            <Text key={line} style={styles.word}>
              {line.toUpperCase()}
            </Text>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stamp: { width: SLIP.stamp, height: SLIP.stamp, padding: SLIP.stampRing },
  field: { flex: 1, backgroundColor: KINPAKU.lacquer, borderRadius: SLIP.stampRadius / 2, padding: SLIP.stampField },
  words: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: KINPAKU.foilShade,
  },
  word: {
    fontFamily: FONT.display,
    fontSize: SLIP.stampWord,
    lineHeight: SLIP.stampLine,
    letterSpacing: WORD_TRACKING,
    color: KINPAKU.foilHighlight,
    textAlign: "center",
  },
});
