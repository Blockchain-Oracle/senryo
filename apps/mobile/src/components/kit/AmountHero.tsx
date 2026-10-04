/**
 * The hero number (D-237 rule 1; behaviour ported from 21st.dev shadcnspace/number-ticker-02, id 21513, which rolls
 * currency with NumberFlow on the web): every digit is a 0–9 column that rolls to its new value, so a balance change
 * reads as motion rather than a swap. Decimals sit in the quiet ink (Fomo's `$0.00`), a partial value carries `≈`.
 * Columns are keyed from the right, so the units digit keeps its column when the number grows. Reduced Motion and the
 * first render never roll. Inputs and review amounts must not use this (they would roll under the user's fingers).
 */
import { useEffect, useRef } from "react";
import { StyleSheet, Text, type TextStyle, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { HERO_FONT_SCALE, TYPE, useTheme } from "~/theme";

const DIGITS = "0123456789";
const ROLL_MS = 420;
const ROLL_EASE = Easing.out(Easing.cubic);
const DECIMAL_POINT = ".";

export interface AmountHeroProps {
  /** Already formatted, e.g. "P$180.18" or "$12,402.55" (money formatting stays in `lib/money`). */
  text: string;
  /** Prefix `≈` and announce "about" when some sources are missing (D-236). */
  partial?: boolean;
  /** Type role; defaults to the display balance. */
  role?: TextStyle;
  color?: string;
  /** Smaller cents for wallet/card balances; review amounts keep their original role. */
  decimalRole?: TextStyle;
  /** Quiet decimals (Fomo); off for amounts where cents carry the meaning. */
  dimDecimals?: boolean;
  accessibilityLabel?: string;
}

export function AmountHero({
  text,
  partial = false,
  role,
  color,
  dimDecimals = true,
  decimalRole,
  accessibilityLabel,
}: AmountHeroProps) {
  const theme = useTheme();
  const style = role ?? TYPE.displayBalance;
  // The text scales with Dynamic Type up to the hero cap; the rolling window must scale with it.
  const { fontScale } = useWindowDimensions();
  const scale = Math.min(fontScale, HERO_FONT_SCALE);
  const metrics = (role: TextStyle): TextStyle => ({
    ...role,
    fontSize: (role.fontSize ?? 0) * scale,
    lineHeight: (role.lineHeight ?? role.fontSize ?? 0) * scale,
    letterSpacing: (role.letterSpacing ?? 0) * scale,
    includeFontPadding: false,
  });
  const ink = color ?? theme.color.ink;
  const quiet = theme.color.text3;
  const shown = partial ? `≈ ${text}` : text;
  const point = shown.lastIndexOf(DECIMAL_POINT);
  const chars = [...shown];
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? (partial ? `About ${text}` : text)}
      style={styles.row}
    >
      {chars.map((ch, i) => {
        const fromRight = chars.length - i;
        const fractional = point >= 0 && i >= point;
        const tint = dimDecimals && fractional ? quiet : ink;
        const charStyle = metrics(fractional && decimalRole ? decimalRole : style);
        const lineHeight = charStyle.lineHeight ?? 0;
        return DIGITS.includes(ch) ? (
          <Digit key={`d${fromRight}`} value={Number(ch)} style={charStyle} color={tint} lineHeight={lineHeight} />
        ) : (
          <Text key={`c${fromRight}`} allowFontScaling={false} style={[charStyle, { color: tint, height: lineHeight }]}>
            {ch}
          </Text>
        );
      })}
    </View>
  );
}

function Digit({
  value,
  style,
  color,
  lineHeight,
}: {
  value: number;
  style: TextStyle;
  color: string;
  lineHeight: number;
}) {
  const reduce = useReducedMotion();
  const offset = useSharedValue(-value * lineHeight);
  const first = useRef(true);
  useEffect(() => {
    const target = -value * lineHeight;
    if (first.current || reduce) {
      first.current = false;
      offset.value = target;
      return;
    }
    offset.value = withTiming(target, { duration: ROLL_MS, easing: ROLL_EASE });
  }, [value, lineHeight, reduce, offset]);
  const column = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
  return (
    <View style={[styles.window, { height: lineHeight }]} importantForAccessibility="no-hide-descendants">
      <Animated.View style={column}>
        {[...DIGITS].map((d) => (
          <Text key={d} allowFontScaling={false} style={[style, { color, height: lineHeight, lineHeight }]}>
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end" },
  window: { overflow: "hidden" },
});
