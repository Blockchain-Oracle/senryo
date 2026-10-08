/**
 * Action circles (D-196: 56 pt + label; Solflare S21's Copy / Share, Phantom's Receive / Send row). Ported in spirit
 * from 21st.dev radiumcoders/grid-button (#13564): an icon disc over a short label, the disc shrinking to 0.97 under the
 * finger. A disabled circle keeps its place and says why in ≤ 4 words under its label.
 */
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import type { SymbolIcon } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { CONTROL_FONT_SCALE, DISABLED_OPACITY, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const CIRCLE = 56;

export function ActionCircle({
  icon: Icon,
  label,
  onPress,
  reason,
  note,
}: {
  icon: SymbolIcon;
  label: string;
  onPress: () => void;
  /** Why it can't be used here ("Mainnet only"); the circle stays, inert. */
  reason?: string | undefined;
  /** A caveat that doesn't stop it ("Sell only"). */
  note?: string | undefined;
}) {
  const { color } = useTheme();
  const press = usePressScale();
  const disabled = reason !== undefined;
  return (
    <View style={[styles.slot, disabled ? styles.dim : null]}>
      <Animated.View style={press.style}>
        <Pressable
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          onPress={() => {
            fire("press");
            onPress();
          }}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={disabled ? `${label}, ${reason}` : label}
          accessibilityState={{ disabled }}
          style={({ pressed }) => [styles.circle, { backgroundColor: pressed ? color.rowPressed : color.raised2 }]}
        >
          <Icon size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.ink} />
        </Pressable>
      </Animated.View>
      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.label, styles.center, { color: color.ink }]}>
        {label}
      </Text>
      {reason || note ? (
        <Text
          maxFontSizeMultiplier={CONTROL_FONT_SCALE}
          numberOfLines={2}
          style={[TYPE.meta, styles.center, { color: color.text3 }]}
        >
          {reason ?? note}
        </Text>
      ) : null}
    </View>
  );
}

/** A row of circles spread evenly (Receive · Send · Swap · Withdraw; Copy · Share · Explorer). */
export function ActionCircles({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-evenly", alignItems: "flex-start", gap: SPACE.sm },
  slot: { alignItems: "center", gap: SPACE.xs, flex: 1, minWidth: 0, maxWidth: CIRCLE + SPACE.xxl },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { textAlign: "center" },
  dim: { opacity: DISABLED_OPACITY },
});
